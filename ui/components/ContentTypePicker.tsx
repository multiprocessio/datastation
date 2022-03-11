import * as React from 'react';
import { ContentTypeInfo } from '../../shared/state';
import { ODS_MIME_TYPE, XLSX_MIME_TYPE } from '../../shared/text';
import { Input } from './Input';
import { Select } from './Select';

export function ContentTypePicker({
  value,
  onChange,
  disableAutoDetect,
  inMemoryEval,
}: {
  value: ContentTypeInfo;
  onChange: (v: ContentTypeInfo) => void;
  disableAutoDetect?: boolean;
  inMemoryEval: boolean;
}) {
  return (
    <React.Fragment>
      <div className="form-row">
        <Select
          label="Content Type"
          value={value.type}
          onChange={(type: string) => {
            if (type === 'null') {
              type = '';
            }

            value.type = type;
            return onChange(value);
          }}
        >
          {!disableAutoDetect && <option value="null">Auto-detect</option>}
          <optgroup label="Raw">
            <option value="text/plain">Plain Text</option>
          </optgroup>
          <optgroup label="Data">
            <option value="text/csv">CSV</option>
            <option value="text/tab-separated-values">TSV</option>
            <option value={XLSX_MIME_TYPE}>Excel</option>
            <option disabled={inMemoryEval} value={ODS_MIME_TYPE}>ODS</option>
            <option disabled={inMemoryEval} value="parquet">Parquet</option>
            <option value="application/json">JSON</option>
            <option value="application/jsonlines">
              Newline-delimited JSON
            </option>
            <option value="application/jsonconcat">Concatenated JSON</option>
          </optgroup>
          <optgroup label="Logs">
            <option value="text/apache2access">
              Apache2 Access Logs (Common Log Format)
            </option>
            <option value="text/apache2error">Apache2 Error Logs</option>
            <option value="text/nginxaccess">Nginx Access Logs</option>
            <option value="application/jsonlines">
              Newline-delimited JSON
            </option>
            <option value="text/regexplines">Newline-delimited Regex</option>
          </optgroup>
        </Select>
      </div>
      {value.type === 'text/regexplines' && (
        <div className="form-row">
          <Input
            autoWidth
            label="Custom Regex"
            type="text"
            value={value.customLineRegexp}
            onChange={(clr: string) => {
              value.customLineRegexp = clr;
              onChange(value);
            }}
            tooltip={
              <React.Fragment>
                <div className="mb-2">
                  Enter a custom ECMAScript-flavor regular expression to be
                  evaluated for each line. Only named capture groups will be
                  returned. For example:
                </div>
                <code>
                  {
                    '^(?<remote>[^ ]*) (?<host>[^ ]*) (?<user>[^ ]*) [(?<time>[^]]*)] "(?<method>S+)(?: +(?<path>[^"]*?)(?: +S*)?)?" (?<code>[^ ]*) (?<size>[^ ]*)(?: "(?<referer>[^"]*)" "(?<agent>[^"]*)"(?:s+(?<http_x_forwarded_for>[^ ]+))?)?$'
                  }
                </code>
              </React.Fragment>
            }
          />
        </div>
      )}
    </React.Fragment>
  );
}
