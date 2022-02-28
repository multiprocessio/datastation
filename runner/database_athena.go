package runner

import (
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/athena"
)

func evalAthena(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, w io.Writer) error {
	cfg := aws.NewConfig().WithRegion(dbInfo.Extra["aws_region"])
	sess := session.Must(session.NewSession(cfg))

	svc := athena.New(sess, cfg)
	var s athena.StartQueryExecutionInput
	s.SetQueryString(panel.Content)

	var q athena.QueryExecutionContext
	q.SetDatabase(dbInfo.Database)
	s.SetQueryExecutionContext(&q)

	var r athena.ResultConfiguration
	r.SetOutputLocation("s3://" + dbInfo.Address)
	s.SetResultConfiguration(&r)

	result, err := svc.StartQueryExecution(&s)
	if err != nil {
		return err
	}
	fmt.Println("StartQueryExecution result:")
	fmt.Println(result.GoString())

	var qri athena.GetQueryExecutionInput
	qri.SetQueryExecutionId(*result.QueryExecutionId)

	var qrop *athena.GetQueryExecutionOutput
	for {
		qrop, err = svc.GetQueryExecution(&qri)
		if err != nil {
			return err
		}
		if *qrop.QueryExecution.Status.State != "RUNNING" {
			break
		}
		time.Sleep(time.Duration(2) * time.Second)
	}

	if *qrop.QueryExecution.Status.State != "SUCCEEDED" {
		return edsef("Athena query unsuccessful: " + *qrop.QueryExecution.Status.State)
	}

	var ip athena.GetQueryResultsInput
	ip.SetQueryExecutionId(*result.QueryExecutionId)

	_, err = svc.GetQueryResults(&ip)
	return err
}
