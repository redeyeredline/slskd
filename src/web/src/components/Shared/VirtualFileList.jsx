import "./VirtualFileList.css";
import {
  formatAttributes,
  formatBytes,
  formatSeconds,
  getFileName,
} from "../../lib/util";
import React, { useMemo, useState } from "react";
import { FixedSizeList as List } from "react-window";
import { Checkbox, Header, Icon, Table } from "semantic-ui-react";

const VirtualFileList = ({
  directoryName,
  disabled,
  files,
  footer,
  locked,
  onClose,
  onSelectionChange,
}) => {
  const [folded, setFolded] = useState(false);

  // Sort files for consistent rendering
  const sortedFiles = useMemo(() => {
    return files.sort((a, b) => (a.filename > b.filename ? 1 : -1));
  }, [files]);

  const handleSelectAll = (checked) => {
    for (const file of sortedFiles) onSelectionChange(file, checked);
  };

  const allSelected =
    sortedFiles.length > 0 &&
    sortedFiles.filter((f) => !f.selected).length === 0;

  if (!files || files.length === 0) {
    return (
      <div style={{ opacity: locked ? 0.5 : 1 }}>
        <Header className="filelist-header" size="small">
          <div>
            <Icon
              link={!locked}
              name={locked ? "lock" : "folder"}
              size="large"
            />
            {directoryName}
            {Boolean(onClose) && (
              <Icon
                className="close-button"
                color="red"
                link
                name="close"
                onClick={() => onClose()}
              />
            )}
          </div>
        </Header>
        <div className="no-files">No files to display</div>
      </div>
    );
  }

   
  const Row = ({ index, style }) => {
    const file = sortedFiles[index];

    return (
      <div style={style}>
        <Table.Row className="virtual-file-row">
          <Table.Cell className="filelist-selector">
            <Checkbox
              checked={file.selected}
              disabled={disabled}
              fitted
              onChange={(event, data) => onSelectionChange(file, data.checked)}
            />
          </Table.Cell>
          <Table.Cell className="filelist-filename">
            {locked ? <Icon name="lock" /> : ""}
            {getFileName(file.filename)}
          </Table.Cell>
          <Table.Cell className="filelist-size">
            {formatBytes(file.size)}
          </Table.Cell>
          <Table.Cell className="filelist-attributes">
            {formatAttributes(file)}
          </Table.Cell>
          <Table.Cell className="filelist-length">
            {formatSeconds(file.length)}
          </Table.Cell>
        </Table.Row>
      </div>
    );
  };

  return (
    <div style={{ opacity: locked ? 0.5 : 1 }}>
      <Header className="filelist-header" size="small">
        <div>
          <Icon
            link={!locked}
            name={locked ? "lock" : folded ? "folder" : "folder open"}
            onClick={() => !locked && setFolded(!folded)}
            size="large"
          />
          {directoryName}
          {Boolean(onClose) && (
            <Icon
              className="close-button"
              color="red"
              link
              name="close"
              onClick={() => onClose()}
            />
          )}
        </div>
      </Header>

      {!folded && (
        <div className="virtual-file-list-container">
          <Table className="virtual-file-table">
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell className="filelist-selector">
                  <Checkbox
                    checked={allSelected}
                    disabled={disabled}
                    fitted
                    onChange={(event, data) => handleSelectAll(data.checked)}
                  />
                </Table.HeaderCell>
                <Table.HeaderCell className="filelist-filename">
                  File
                </Table.HeaderCell>
                <Table.HeaderCell className="filelist-size">
                  Size
                </Table.HeaderCell>
                <Table.HeaderCell className="filelist-attributes">
                  Attributes
                </Table.HeaderCell>
                <Table.HeaderCell className="filelist-length">
                  Length
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
          </Table>

          <div className="virtual-file-list">
            <List
              height={400}
              itemCount={sortedFiles.length}
              itemSize={40}
              width="100%"
            >
              {Row}
            </List>
          </div>

          {footer && (
            <Table className="virtual-file-table-footer">
              <Table.Footer fullWidth>
                <Table.Row>
                  <Table.HeaderCell colSpan="5">{footer}</Table.HeaderCell>
                </Table.Row>
              </Table.Footer>
            </Table>
          )}
        </div>
      )}
    </div>
  );
};

export default VirtualFileList;
