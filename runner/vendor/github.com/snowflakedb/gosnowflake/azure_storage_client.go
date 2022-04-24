// Copyright (c) 2021-2022 Snowflake Computing Inc. All rights reserved.

package gosnowflake

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/Azure/azure-storage-blob-go/azblob"
)

type snowflakeAzureClient struct {
}

type azureLocation struct {
	containerName string
	path          string
}

func (util *snowflakeAzureClient) createClient(info *execResponseStageInfo, _ bool) (cloudClient, error) {
	sasToken := info.Creds.AzureSasToken
	p := azblob.NewPipeline(azblob.NewAnonymousCredential(), azblob.PipelineOptions{
		Retry: azblob.RetryOptions{
			Policy:     azblob.RetryPolicyExponential,
			MaxTries:   60,
			RetryDelay: 2 * time.Second,
		},
	})

	u, err := url.Parse(fmt.Sprintf("https://%s.%s/%s%s", info.StorageAccount, info.EndPoint, info.Path, sasToken))
	if err != nil {
		return nil, err
	}
	containerURL := azblob.NewContainerURL(*u, p)
	return &containerURL, nil
}

// cloudUtil implementation
func (util *snowflakeAzureClient) getFileHeader(meta *fileMetadata, filename string) (*fileHeader, error) {
	container, ok := meta.client.(*azblob.ContainerURL)
	if !ok {
		return nil, fmt.Errorf("failed to parse client to azblob.ContainerURL")
	}

	azureLoc, err := util.extractContainerNameAndPath(meta.stageInfo.Location)
	if err != nil {
		return nil, err
	}
	path := azureLoc.path + strings.TrimLeft(filename, "/")
	b := container.NewBlockBlobURL(path)
	resp, err := b.GetProperties(context.Background(), azblob.BlobAccessConditions{}, azblob.ClientProvidedKeyOptions{})
	if err != nil {
		var se azblob.StorageError
		if errors.As(err, &se) {
			if se.ServiceCode() == azblob.ServiceCodeBlobNotFound {
				meta.resStatus = notFoundFile
				return nil, fmt.Errorf("could not find file")
			} else if se.Response().StatusCode == 403 {
				meta.resStatus = renewToken
				return nil, fmt.Errorf("received 403, attempting to renew")
			}
		}
		meta.resStatus = errStatus
		return nil, err
	}

	meta.resStatus = uploaded
	metadata := resp.NewMetadata()
	var encData encryptionData
	if err = json.Unmarshal([]byte(metadata["encryptiondata"]), &encData); err != nil {
		return nil, err
	}
	encryptionMetadata := encryptMetadata{
		encData.WrappedContentKey.EncryptionKey,
		encData.ContentEncryptionIV,
		metadata["matdesc"],
	}

	return &fileHeader{
		metadata["sfcdigest"],
		int64(len(metadata)),
		&encryptionMetadata,
	}, nil
}

// cloudUtil implementation
func (util *snowflakeAzureClient) uploadFile(
	dataFile string,
	meta *fileMetadata,
	encryptMeta *encryptMetadata,
	maxConcurrency int,
	multiPartThreshold int64) error {
	azureMeta := map[string]string{
		"sfcdigest": meta.sha256Digest,
	}
	if encryptMeta != nil {
		ed := &encryptionData{
			EncryptionMode: "FullBlob",
			WrappedContentKey: contentKey{
				"symmKey1",
				encryptMeta.key,
				"AES_CBC_256",
			},
			EncryptionAgent: encryptionAgent{
				"1.0",
				"AES_CBC_128",
			},
			ContentEncryptionIV: encryptMeta.iv,
			KeyWrappingMetadata: keyMetadata{
				"Java 5.3.0",
			},
		}
		metadata, err := json.Marshal(ed)
		if err != nil {
			return err
		}
		azureMeta["encryptiondata"] = string(metadata)
		azureMeta["matdesc"] = encryptMeta.matdesc
	}

	azureLoc, err := util.extractContainerNameAndPath(meta.stageInfo.Location)
	if err != nil {
		return err
	}
	path := azureLoc.path + strings.TrimLeft(meta.dstFileName, "/")
	azContainerURL, ok := meta.client.(*azblob.ContainerURL)
	if !ok {
		return &SnowflakeError{
			Message: "failed to cast to azure client",
		}
	}

	blobURL := azContainerURL.NewBlockBlobURL(path)
	if meta.srcStream != nil {
		uploadSrc := meta.srcStream
		if meta.realSrcStream != nil {
			uploadSrc = meta.realSrcStream
		}
		_, err = azblob.UploadStreamToBlockBlob(context.Background(), uploadSrc, blobURL, azblob.UploadStreamToBlockBlobOptions{
			BufferSize: uploadSrc.Len(),
			Metadata:   azureMeta,
		})
	} else {
		var f *os.File
		f, err = os.OpenFile(dataFile, os.O_RDONLY, os.ModePerm)
		if err != nil {
			return err
		}
		defer f.Close()

		blobOptions := azblob.UploadToBlockBlobOptions{
			BlobHTTPHeaders: azblob.BlobHTTPHeaders{
				ContentType:     httpHeaderValueOctetStream,
				ContentEncoding: "utf-8",
			},
			Metadata:    azureMeta,
			Parallelism: uint16(maxConcurrency),
		}
		if meta.options.putAzureCallback != nil {
			blobOptions.Progress = meta.options.putAzureCallback.call
		}
		_, err = azblob.UploadFileToBlockBlob(context.Background(), f, blobURL, blobOptions)
	}
	if err != nil {
		var se azblob.StorageError
		if errors.As(err, &se) {
			if se.Response().StatusCode == 403 && util.detectAzureTokenExpireError(se.Response()) {
				meta.resStatus = renewToken
			} else {
				meta.resStatus = needRetry
				meta.lastError = err
			}
			return err
		}
		meta.resStatus = errStatus
		return err
	}

	meta.dstFileSize = meta.uploadSize
	meta.resStatus = uploaded
	return nil
}

// cloudUtil implementation
func (util *snowflakeAzureClient) nativeDownloadFile(
	meta *fileMetadata,
	fullDstFileName string,
	maxConcurrency int64) error {
	azureLoc, err := util.extractContainerNameAndPath(meta.stageInfo.Location)
	if err != nil {
		return err
	}
	path := azureLoc.path + strings.TrimLeft(meta.srcFileName, "/")
	azContainerURL, ok := meta.client.(*azblob.ContainerURL)
	if !ok {
		return &SnowflakeError{
			Message: "failed to cast to azure client",
		}
	}

	f, err := os.OpenFile(fullDstFileName, os.O_CREATE|os.O_WRONLY, os.ModePerm)
	if err != nil {
		return err
	}
	defer f.Close()
	blobURL := azContainerURL.NewBlockBlobURL(path)
	if err = azblob.DownloadBlobToFile(
		context.Background(), blobURL.BlobURL, 0, azblob.CountToEnd, f,
		azblob.DownloadFromBlobOptions{Parallelism: uint16(maxConcurrency)}); err != nil {
		return err
	}
	meta.resStatus = downloaded
	return nil
}

func (util *snowflakeAzureClient) extractContainerNameAndPath(location string) (*azureLocation, error) {
	stageLocation, err := expandUser(location)
	if err != nil {
		return nil, err
	}
	containerName := stageLocation
	path := ""

	if strings.Contains(stageLocation, "/") {
		containerName = stageLocation[:strings.Index(stageLocation, "/")]
		path = stageLocation[strings.Index(stageLocation, "/")+1:]
		if path != "" && !strings.HasSuffix(path, "/") {
			path += "/"
		}
	}
	return &azureLocation{containerName, path}, nil
}

func (util *snowflakeAzureClient) detectAzureTokenExpireError(resp *http.Response) bool {
	if resp.StatusCode != 403 {
		return false
	}
	azureErr, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return false
	}
	errStr := string(azureErr)
	return strings.Contains(errStr, "Signature not valid in the specified time frame") ||
		strings.Contains(errStr, "Server failed to authenticate the request")
}
