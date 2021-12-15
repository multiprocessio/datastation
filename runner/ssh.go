package main

import (
	"compress/gzip"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io"
	"io/ioutil"
	"strings"

	"golang.org/x/crypto/ssh"
)

// ADAPTED: https://gist.github.com/stefanprodan/2d20d0c6fdab6f14ce8219464e8b4b9a
func getSSHPrivateKeySigner(privateKeyFile, passphrase string) (ssh.AuthMethod, error) {
	pemBytes, err := ioutil.ReadFile(resolvePath(privateKeyFile))
	if err != nil {
		return nil, fmt.Errorf("Unable to read private key: %s", err)
	}

	pemBlock, _ := pem.Decode(pemBytes)
	if pemBlock == nil {
		return nil, fmt.Errorf("Private key decode failed")
	}

	// Handle encrypted private keys
	if x509.IsEncryptedPEMBlock(pemBlock) {
		pemBlock.Bytes, err = x509.DecryptPEMBlock(pemBlock, []byte(passphrase))
		if err != nil {
			return nil, fmt.Errorf("Decrypting private key failed: %s", err)
		}

		key, err := parsePemBlock(pemBlock)
		if err != nil {
			return nil, err
		}

		signer, err := ssh.NewSignerFromKey(key)
		if err != nil {
			return nil, fmt.Errorf("Creating signer from encrypted key failed: %s", err)
		}

		return ssh.PublicKeys(signer), nil
	}

	// Not encrypted
	signer, err := ssh.ParsePrivateKey(pemBytes)
	if err != nil {
		return nil, fmt.Errorf("Parsing plain private key failed: %s", err)
	}

	return ssh.PublicKeys(signer), nil
}

// ssh.NewSignerFromKey actually takes an interface{}... so great.
func parsePemBlock(block *pem.Block) (interface{}, error) {
	switch block.Type {
	case "RSA PRIVATE KEY":
		key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("Parsing PKCS private key failed: %s", err)
		}

		return key, nil
	case "EC PRIVATE KEY":
		key, err := x509.ParseECPrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("Parsing EC private key failed: %s", err)
		}

		return key, nil
	case "DSA PRIVATE KEY":
		key, err := ssh.ParseDSAPrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("Parsing DSA private key failed: %s", err)
		}

		return key, nil
	}

	return nil, fmt.Errorf("Unsupported private key type: %s", block.Type)
}

func getSSHSession(si ServerInfo) (*ssh.Session, error) {
	config := &ssh.ClientConfig{
		User: si.Username,
		// TODO: figure out if we want to validate host keys
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}
	switch si.Type {
	case SSHPassword:
		password, err := si.Password.decrypt()
		if err != nil {
			return nil, fmt.Errorf("Could not decrypt server SSH password: " + err.Error())
		}
		config.Auth = []ssh.AuthMethod{ssh.Password(password)}
	case SSHPrivateKey:
		passphrase, err := si.Passphrase.decrypt()
		if err != nil {
			return nil, fmt.Errorf("Could not decrypt server SSH passphrase: " + err.Error())
		}
		authmethod, err := getSSHPrivateKeySigner(si.PrivateKeyFile, passphrase)
		if err != nil {
			return nil, err
		}
		config.Auth = []ssh.AuthMethod{authmethod}
	}

	if !strings.Contains(si.Address, ":") {
		si.Address = si.Address + ":22"
	}

	conn, err := ssh.Dial("tcp", si.Address, config)
	if err != nil {
		return nil, fmt.Errorf("Could not connect to remote server: %s", err)
	}

	return conn.NewSession()
}

func remoteFileReader(si ServerInfo, remoteFileName string, callback func(r io.Reader) error) error {
	session, err := getSSHSession(si)
	if err != nil {
		return err
	}
	defer session.Close()

	r, err := session.StdoutPipe()
	if err != nil {
		return fmt.Errorf("Could not create stdout pipe: %s", err)
	}

	cmd := fmt.Sprintf(`if command -v gzip > /dev/null 2>&1; then
  cat %s | gzip
else
  cat %s
fi`, remoteFileName, remoteFileName)
	if err := session.Start(cmd); err != nil {
		return fmt.Errorf("Could not start session command: %s", err)
	}

	fz, err := gzip.NewReader(r)
	if err != nil {
		return fmt.Errorf("Could not create gzip reader: %s", err)
	}
	defer fz.Close()

	err = callback(fz)
	if err != nil {
		return err
	}

	if err := session.Wait(); err != nil {
		return fmt.Errorf("Could not complete session: %s", err)
	}

	return nil
}
