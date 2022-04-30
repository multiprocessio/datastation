package runner

import (
	"bufio"
	"compress/gzip"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"os"
	"strings"

	"golang.org/x/crypto/ssh"
)

// ADAPTED: https://gist.github.com/stefanprodan/2d20d0c6fdab6f14ce8219464e8b4b9a
func getSSHPrivateKeySigner(privateKeyFile, passphrase string) (ssh.AuthMethod, error) {
	pemBytes, err := ioutil.ReadFile(resolvePath(privateKeyFile))
	if err != nil {
		return nil, edsef("Unable to read private key: %s", err)
	}

	pemBlock, _ := pem.Decode(pemBytes)
	if pemBlock == nil {
		return nil, edsef("Private key decode failed")
	}

	// Handle encrypted private keys
	if x509.IsEncryptedPEMBlock(pemBlock) {
		pemBlock.Bytes, err = x509.DecryptPEMBlock(pemBlock, []byte(passphrase))
		if err != nil {
			return nil, edsef("Decrypting private key failed: %s", err)
		}

		key, err := parsePemBlock(pemBlock)
		if err != nil {
			return nil, err
		}

		signer, err := ssh.NewSignerFromKey(key)
		if err != nil {
			return nil, edsef("Creating signer from encrypted key failed: %s", err)
		}

		return ssh.PublicKeys(signer), nil
	}

	// Not encrypted
	signer, err := ssh.ParsePrivateKey(pemBytes)
	if err != nil {
		return nil, edsef("Parsing plain private key failed: %s", err)
	}

	return ssh.PublicKeys(signer), nil
}

// ssh.NewSignerFromKey actually takes an interface{}... so great.
func parsePemBlock(block *pem.Block) (any, error) {
	switch block.Type {
	case "RSA PRIVATE KEY":
		key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return nil, edsef("Parsing PKCS private key failed: %s", err)
		}

		return key, nil
	case "EC PRIVATE KEY":
		key, err := x509.ParseECPrivateKey(block.Bytes)
		if err != nil {
			return nil, edsef("Parsing EC private key failed: %s", err)
		}

		return key, nil
	case "DSA PRIVATE KEY":
		key, err := ssh.ParseDSAPrivateKey(block.Bytes)
		if err != nil {
			return nil, edsef("Parsing DSA private key failed: %s", err)
		}

		return key, nil
	}

	return nil, edsef("Unsupported private key type: %s", block.Type)
}

var defaultKeyFiles = []string{
	"~/.ssh/id_rsa",
	"~/.ssh/id_dsa",
	"~/.ssh/id_ed25519",
}

func (ec EvalContext) getSSHClient(si ServerInfo) (*ssh.Client, error) {
	config := &ssh.ClientConfig{
		User: si.Username,
		// TODO: figure out if we want to validate host keys
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}
	switch si.Type {
	case SSHPassword:
		password, err := ec.decrypt(&si.Password)
		if err != nil {
			return nil, edsef("Could not decrypt server SSH password: " + err.Error())
		}
		config.Auth = []ssh.AuthMethod{ssh.Password(password)}
	case SSHPrivateKey:
		if si.PrivateKeyFile != "" {
			passphrase, err := ec.decrypt(&si.Passphrase)
			if err != nil {
				return nil, edsef("Could not decrypt server SSH passphrase: " + err.Error())
			}
			authmethod, err := getSSHPrivateKeySigner(si.PrivateKeyFile, passphrase)
			if err != nil {
				return nil, err
			}
			config.Auth = []ssh.AuthMethod{authmethod}
		} else {
			// Try all default path ssh files
			for _, f := range defaultKeyFiles {
				resolved := resolvePath(f)
				if _, err := os.Stat(resolved); err == nil {
					authmethod, err := getSSHPrivateKeySigner(resolved, "")
					if err != nil {
						return nil, err
					}
					config.Auth = []ssh.AuthMethod{authmethod}
				}
			}
		}
	default:
		return nil, edsef("SSH Agent authentication is not supported yet.")
	}

	if !strings.Contains(si.Address, ":") {
		si.Address = si.Address + ":22"
	}

	conn, err := ssh.Dial("tcp", si.Address, config)
	if err != nil {
		return nil, edsef("Could not connect to remote server: %s", err)
	}

	return conn, nil
}

func (ec EvalContext) remoteFileReader(si ServerInfo, remoteFileName string, callback func(r *bufio.Reader) error) error {
	client, err := ec.getSSHClient(si)
	if err != nil {
		return err
	}

	session, err := client.NewSession()
	if err != nil {
		return err
	}
	defer session.Close()

	r, err := session.StdoutPipe()
	if err != nil {
		return edsef("Could not create stdout pipe: %s", err)
	}

	cmd := fmt.Sprintf(`if command -v gzip > /dev/null 2>&1; then
  cat %s | gzip
else
  cat %s
fi`, remoteFileName, remoteFileName)
	if err := session.Start(cmd); err != nil {
		return edsef("Could not start session command: %s", err)
	}

	// Clone the stream to peak if it is gzipped
	buffer := bufio.NewReaderSize(r, 4096*20)
	magicBytes, err := buffer.Peek(2)
	if err != nil {
		return edsef("Could not read magic number from stream: %s", err)
	}

	// Set default reader to be plain text
	var reader = buffer

	// If it is gzipped, set the reader to be a gzip reader
	if magicBytes[0] == 0x1F && magicBytes[1] == 0x8B {
		fz, err := gzip.NewReader(buffer)
		if err != nil {
			return edsef("Could not create gzip reader: %s", err)
		}

		reader = bufio.NewReaderSize(fz, 4096*20)
		defer fz.Close()
	}

	err = callback(reader)
	if err != nil {
		return err
	}

	if err := session.Wait(); err != nil {
		return edsef("Could not complete session: %s", err)
	}

	return nil
}

// SOURCE: https://www.stavros.io/posts/proxying-two-connections-go/
func chanFromConn(conn net.Conn) chan []byte {
	c := make(chan []byte)

	go func() {
		b := make([]byte, 1024)

		for {
			n, err := conn.Read(b)
			if n > 0 {
				res := make([]byte, n)
				// Copy the buffer so it doesn't get changed while read by the recipient.
				copy(res, b[:n])
				c <- res
			}
			if err != nil {
				c <- nil
				break
			}
		}
	}()

	return c
}

// SOURCE: https://www.stavros.io/posts/proxying-two-connections-go/
func pipe(conn1 net.Conn, conn2 net.Conn) {
	chan1 := chanFromConn(conn1)
	chan2 := chanFromConn(conn2)

	for {
		select {
		case b1 := <-chan1:
			if b1 == nil {
				return
			} else {
				conn2.Write(b1)
			}
		case b2 := <-chan2:
			if b2 == nil {
				return
			} else {
				conn1.Write(b2)
			}
		}
	}
}

func (ec EvalContext) withRemoteConnection(si *ServerInfo, host, port string, cb func(host, port string) error) error {
	if si == nil {
		return cb(host, port)
	}

	// Pick any open port
	localConn, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return err
	}
	defer localConn.Close()

	client, err := ec.getSSHClient(*si)
	if err != nil {
		return err
	}

	remoteConn, err := client.Dial("tcp", host+":"+port)
	if err != nil {
		return err
	}
	defer remoteConn.Close()

	errC := make(chan error)

	// Local server
	go func() {
		localConn, err := localConn.Accept()
		if err != nil {
			errC <- err
			return
		}

		pipe(localConn, remoteConn)
	}()

	localPort := localConn.Addr().(*net.TCPAddr).Port
	cbErr := cb("localhost", fmt.Sprintf("%d", localPort))
	if cbErr != nil {
		return cbErr
	}

	select {
	case err = <-errC:
		if err == io.EOF {
			return nil
		}

		return err
	default:
		return nil
	}
}
