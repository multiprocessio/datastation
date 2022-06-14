package runner

import (
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/ec2metadata"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/athena"
)

func mapAthenaType(value, t string) any {
	switch t {
	case "boolean":
		return value == "true"
	case "date":
		t, _ := time.Parse("2006-01-02", value)
		return t
	case "timestamp":
		t, _ := time.Parse(time.RFC3339, value)
		return t
	case "integer", "int", "tinyint", "smallint", "bigint":
		i, _ := strconv.ParseInt(value, 10, 64)
		return i
	case "float", "decimal":
		f, _ := strconv.ParseFloat(value, 64)
		return f
	default:
		// All string values and everything else keep as a string
		return value
	}
}

func (ec EvalContext) evalAthena(panel *PanelInfo, dbInfo DatabaseConnectorInfoDatabase, w *ResultWriter) error {
	secret, err := ec.decrypt(&dbInfo.Password)
	if err != nil {
		return err
	}

	cfg := aws.NewConfig().WithRegion(dbInfo.Extra["aws_region"])
	// Needed for ec2roleprovider
	sess := session.Must(session.NewSession(cfg))
	cfg.Credentials = credentials.NewChainCredentials(
		[]credentials.Provider{
			&credentials.StaticProvider{Value: credentials.Value{
				AccessKeyID:     dbInfo.Username,
				SecretAccessKey: secret,
				SessionToken:    dbInfo.Extra["aws_temp_security_token"],
			}},
			&credentials.EnvProvider{},
			&ec2rolecreds.EC2RoleProvider{
				Client: ec2metadata.New(sess),
			},
		})

	sess = session.Must(session.NewSession(cfg))

	svc := athena.New(sess, cfg)
	var s athena.StartQueryExecutionInput
	s.SetQueryString(panel.Content)

	var q athena.QueryExecutionContext
	q.SetDatabase(dbInfo.Database)
	s.SetQueryExecutionContext(&q)

	var r athena.ResultConfiguration
	r.SetOutputLocation(dbInfo.Address)
	s.SetResultConfiguration(&r)

	result, err := svc.StartQueryExecution(&s)
	if err != nil {
		return err
	}

	var qri athena.GetQueryExecutionInput
	qri.SetQueryExecutionId(*result.QueryExecutionId)

	var qrop *athena.GetQueryExecutionOutput
	for {
		qrop, err = svc.GetQueryExecution(&qri)
		if err != nil {
			return err
		}

		state := *qrop.QueryExecution.Status.State
		if state != "RUNNING" && state != "QUEUED" {
			break
		}
		time.Sleep(time.Duration(2) * time.Second)
	}

	if *qrop.QueryExecution.Status.State != "SUCCEEDED" {
		return makeErrUser(qrop.QueryExecution.Status.GoString())
	}

	var ip athena.GetQueryResultsInput
	ip.SetQueryExecutionId(*result.QueryExecutionId)

	row := map[string]any{}
	first := true
	var columns []string
	var types []string
	errC := make(chan error)
	err = svc.GetQueryResultsPages(&ip,
		func(page *athena.GetQueryResultsOutput, lastPage bool) bool {
			if first {
				for _, col := range page.ResultSet.ResultSetMetadata.ColumnInfo {
					columns = append(columns, *col.Name)
					types = append(types, *col.Type)
				}
			}

			for _, r := range page.ResultSet.Rows {
				if first {
					first = false
					continue
				}

				for i, cell := range r.Data {
					if cell.VarCharValue == nil {
						row[columns[i]] = nil
						continue
					}
					row[columns[i]] = mapAthenaType(*cell.VarCharValue, types[i])
				}

				err = w.WriteRow(row)
				if err != nil {
					errC <- err
					return false
				}
			}

			// Continue iterating
			return true
		})
	if err != nil {
		return err
	}

	select {
	case err = <-errC:
		return err
	default:
		return nil
	}
}
