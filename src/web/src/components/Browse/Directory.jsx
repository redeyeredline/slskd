import * as transfers from '../../lib/transfers';
import * as users from '../../lib/users';
import { formatBytes, sleep } from '../../lib/util';
import VirtualFileList from '../Shared/VirtualFileList';
import React, { Component } from 'react';
import { toast } from 'react-toastify';
import { Button, Card, Checkbox, Icon, Label, List } from 'semantic-ui-react';

const initialState = {
  downloadError: '',
  downloadRequest: undefined,
};

class Directory extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ...initialState,
      files: this.props.files.map((f) => ({ selected: false, ...f })),
      selectedSubdirectories: new Set(), // Track selected subdirectories separately
      subdirectories: this.props.subdirectories || [],
      totalSelectedSubdirBytes: 0,
      totalSelectedSubdirFiles: 0,
    };
  }

  async componentDidUpdate(previousProps, previousState) {
    if (this.props.name !== previousProps.name) {
      this.setState({
        files: this.props.files.map((f) => ({ selected: false, ...f })),
        selectedSubdirectories: new Set(), // Reset selected subdirectories when directory changes
        subdirectories: this.props.subdirectories || [],
        totalSelectedSubdirBytes: 0,
        totalSelectedSubdirFiles: 0,
      });
    }

    // If selectedSubdirectories or subdirectories changed, recalculate totals
    if (
      previousState.selectedSubdirectories !==
        this.state.selectedSubdirectories ||
      previousState.subdirectories !== this.state.subdirectories
    ) {
      this.updateSelectedSubdirTotals();
    }
  }

  updateSelectedSubdirTotals = async () => {
    const { selectedSubdirectories, subdirectories } = this.state;
    const { name, username } = this.props;
    let fileCount = 0;
    let byteCount = 0;
    for (const subdir of subdirectories) {
      if (selectedSubdirectories.has(subdir.name)) {
        try {
          const response = await users.getDirectoryContents({
            directory: `${name}${this.props.separator || '/'}${subdir.name}`,
            username,
          });
          if (response && response.files && Array.isArray(response.files)) {
            fileCount += response.files.length;
            byteCount += response.files.reduce(
              (sum, f) => sum + (f.size || 0),
              0,
            );
          }
        } catch {
          // ignore errors for now
        }
      }
    }

    this.setState({
      totalSelectedSubdirBytes: byteCount,
      totalSelectedSubdirFiles: fileCount,
    });
  };

  // Helper: Recursively fetch all files in a directory and its subdirectories
  fetchAllFilesRecursive = async (directory, username, separator) => {
    console.log('[fetchAllFilesRecursive] Fetching:', directory);
    let allFiles = [];
    let retries = 0;
    let response = null;
    const maxRetries = 3;
    while (retries < maxRetries) {
      try {
        console.log('[fetchAllFilesRecursive] Request payload:', {
          directory,
          username,
        });
        response = await users.getDirectoryContents({
          directory,
          username,
        });
        console.log(
          '[fetchAllFilesRecursive] Backend response for',
          directory,
          ':',
          response,
        );
        break;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) throw error;
        await sleep(2 ** retries * 500); // Use util.js sleep function
      }
    }

    // Patch: handle backend response as array of objects
    let directoryResponse = response;
    if (Array.isArray(response) && response.length > 0) {
      directoryResponse = response[0];
    }

    if (
      directoryResponse &&
      directoryResponse.files &&
      Array.isArray(directoryResponse.files)
    ) {
      console.log(
        '[fetchAllFilesRecursive] Files found in',
        directory,
        ':',
        directoryResponse.files,
      );
      allFiles = allFiles.concat(
        directoryResponse.files.map((file) => ({
          filename: `${directory}${separator || '/'}${file.filename}`,
          size: file.size,
        })),
      );
    } else {
      console.log('[fetchAllFilesRecursive] No files found in', directory);
    }

    if (
      directoryResponse &&
      directoryResponse.directories &&
      Array.isArray(directoryResponse.directories)
    ) {
      for (const subdir of directoryResponse.directories) {
        const subdirPath = `${directory}${separator || '/'}${subdir.name}`;
        console.log(
          '[fetchAllFilesRecursive] Recursing into subdir:',
          subdirPath,
        );
        const subFiles = await this.fetchAllFilesRecursive(
          subdirPath,
          username,
          separator,
        );
        allFiles = allFiles.concat(subFiles);
      }
    }

    return allFiles;
  };

  /* eslint-disable complexity */
  download = async (username, files, selectedSubdirectories) => {
    this.setState({ downloadRequest: 'inProgress' }, async () => {
      toast.info(
        `Starting download process for ${selectedSubdirectories.size} subdirectories...`,
      );
      try {
        const fileRequests = (files || []).map(({ filename, size }) => ({
          filename,
          size,
        }));
        const subdirFileRequests = [];
        const separator = this.props.separator || '/';
        for (const subdirName of selectedSubdirectories) {
          const cleanSubdirName = subdirName.replace(/\s*\(\d+\)$/u, '');
          const subdirPath = `${this.props.name}${separator}${cleanSubdirName}`;
          const allFiles = await this.fetchAllFilesRecursive(
            subdirPath,
            username,
            separator,
          );
          for (const file of allFiles) {
            subdirFileRequests.push({
              filename: file.filename,
              size: file.size,
            });
          }
        }

        const allRequests = [...fileRequests, ...subdirFileRequests];
        if (allRequests.length > 0) {
          await transfers.download({ files: allRequests, username });
          toast.success(
            `Download request submitted successfully! ${allRequests.length} files queued for download.`,
          );
        } else {
          toast.info(
            'No files found to download from the selected subdirectories.',
          );
        }

        this.setState({ downloadRequest: 'complete' });
      } catch (error) {
        this.setState({
          downloadError: error.response,
          downloadRequest: 'error',
        });
      }
    });
  };
  /* eslint-enable complexity */

  handleFileSelectionChange = (file, state) => {
    file.selected = state;
    this.setState((previousState) => ({
      downloadError: '',
      downloadRequest: undefined,
      tree: previousState.tree,
    }));
  };

  handleSubdirectorySelection = (subdir, state) => {
    this.setState((previousState) => {
      const newSelectedSubdirectories = new Set(
        previousState.selectedSubdirectories,
      );

      if (state) {
        newSelectedSubdirectories.add(subdir.name);
      } else {
        newSelectedSubdirectories.delete(subdir.name);
      }

      return { selectedSubdirectories: newSelectedSubdirectories };
    });
  };

  renderSubdirectoryList(
    subdirectories,
    selectedSubdirectories,
    downloadRequest,
    locked,
  ) {
    return subdirectories.map((subdir) => {
      const subdirSelected = selectedSubdirectories.has(subdir.name);
      return (
        <List.Item
          key={subdir.name}
          style={{
            alignItems: 'center',
            borderRadius: '4px',
            cursor: 'default',
            display: 'flex',
            gap: '10px',
            padding: '8px 12px',
          }}
        >
          <Checkbox
            checked={subdirSelected}
            disabled={downloadRequest === 'inProgress' || locked}
            onChange={(event, data) => {
              event.stopPropagation();
              this.handleSubdirectorySelection(subdir, data.checked);
            }}
          />
          <Icon name="folder" />
          <List.Content style={{ flex: 1 }}>
            <List.Header style={{ color: '#ffffff', fontWeight: '500' }}>
              {subdir.name}
            </List.Header>
            <List.Description style={{ color: '#cccccc', fontSize: '0.9em' }}>
              Select to download entire folder
            </List.Description>
          </List.Content>
        </List.Item>
      );
    });
  }

  renderDownloadButton(
    selectedFiles,
    selectedSubdirectories,
    totalSelectedSubdirFiles,
    downloadRequest,
    locked,
    username,
  ) {
    return (
      <Button
        color="green"
        disabled={
          (selectedFiles.length === 0 && selectedSubdirectories.size === 0) ||
          downloadRequest === 'inProgress' ||
          locked
        }
        loading={downloadRequest === 'inProgress'}
        onClick={async () => {
          await this.download(username, selectedFiles, selectedSubdirectories);
        }}
      >
        <Icon name="download" />
        Download
        {selectedFiles.length > 0 || selectedSubdirectories.size > 0 ? (
          <>
            {' '}
            {selectedFiles.length > 0 && `${selectedFiles.length} files`}
            {selectedFiles.length > 0 &&
              selectedSubdirectories.size > 0 &&
              ', '}
            {selectedSubdirectories.size > 0 &&
              `${selectedSubdirectories.size} folder${selectedSubdirectories.size > 1 ? 's' : ''}`}
            {this.state.totalSelectedSubdirFiles > 0 &&
              ` (${this.state.totalSelectedSubdirFiles} files in selected folders)`}
            {this.state.totalSelectedSubdirBytes > 0 &&
              `, ${formatBytes(this.state.totalSelectedSubdirBytes)} in selected folders`}
            {', '}
            {formatBytes(selectedFiles.reduce((total, f) => total + f.size, 0))}
          </>
        ) : (
          ' 0 files, 0 folders, 0 B'
        )}
      </Button>
    );
  }

  render() {
    const { locked, marginTop, name, onClose, username, subdirectories: propSubdirs } = this.props;
    const {
      downloadError,
      downloadRequest,
      files,
      selectedSubdirectories,
      subdirectories,
    } = this.state;

    // Debug log
    console.log('[Directory] render: propSubdirs:', propSubdirs, 'state.subdirectories:', subdirectories);

    const selectedFiles = files.filter((f) => f.selected);

    // const allFilesSelected =
    //   files.length > 0 && selectedFiles.length === files.length;

    /* const handleSelectAllFiles = (checked) => {
      for (const file of files) {
        file.selected = checked;
      }

      this.setState({ files: [...files] });
    };*/

    const allSubdirsSelected =
      propSubdirs && propSubdirs.length > 0 &&
      propSubdirs.every((subdir) => selectedSubdirectories.has(subdir.name));

    const someSubdirsSelected = propSubdirs && propSubdirs.some((subdir) =>
      selectedSubdirectories.has(subdir.name),
    );

    const handleSelectAllSubdirs = (checked) => {
      const newSelected = new Set(selectedSubdirectories);
      if (checked) {
        for (const subdir of propSubdirs) {
          newSelected.add(subdir.name);
        }
      } else {
        for (const subdir of propSubdirs) {
          newSelected.delete(subdir.name);
        }
      }

      this.setState({ selectedSubdirectories: newSelected });
    };

    // Remove useState/useEffect and use this.state.totalSelectedSubdirFiles/Bytes

    const hasContent = files.length > 0 || (propSubdirs && propSubdirs.length > 0);

    return (
      <Card
        className="result-card"
        raised
      >
        <Card.Content>
          <div style={{ marginTop: marginTop || 0 }}>
            {/* Folder Selection Header */}
            <div
              style={{
                alignItems: 'center',
                backgroundColor: '#f9f9f9',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                gap: '10px',
                padding: '10px',
              }}
            >
              {/* Removed big white 'Select entire folder' checkbox */}
              {selectedFiles.length > 0 && (
                <span style={{ color: '#666', fontSize: '0.9em' }}>
                  {selectedFiles.length} of {files.length} files selected
                </span>
              )}
            </div>

            {hasContent ? (
              <>
                {/* Subdirectories Section */}
                {propSubdirs && propSubdirs.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ color: '#333', margin: '10px 0' }}>
                      Subdirectories
                    </h4>
                    <div style={{ marginBottom: '8px' }}>
                      <Checkbox
                        checked={allSubdirsSelected}
                        disabled={downloadRequest === 'inProgress' || locked}
                        indeterminate={
                          someSubdirsSelected && !allSubdirsSelected
                        }
                        label="Select all subfolders"
                        onChange={(event, data) =>
                          handleSelectAllSubdirs(data.checked)
                        }
                      />
                    </div>
                    <List
                      divided
                      relaxed
                    >
                      {this.renderSubdirectoryList(
                        propSubdirs,
                        selectedSubdirectories,
                        downloadRequest,
                        locked,
                      )}
                    </List>
                  </div>
                )}

                {/* Files Section */}
                {files.length > 0 && (
                  <VirtualFileList
                    directoryName={name}
                    disabled={downloadRequest === 'inProgress'}
                    files={files}
                    locked={locked}
                    onClose={onClose}
                    onSelectionChange={this.handleFileSelectionChange}
                  />
                )}
              </>
            ) : (
              <div
                style={{ color: '#666', padding: '20px', textAlign: 'center' }}
              >
                No files or subdirectories to display
              </div>
            )}
          </div>
        </Card.Content>
        {(selectedFiles.length > 0 || selectedSubdirectories.size > 0) && (
          <Card.Content extra>
            <span>
              {this.renderDownloadButton(
                selectedFiles,
                selectedSubdirectories,
                this.state.totalSelectedSubdirFiles,
                downloadRequest,
                locked,
                username,
              )}
              {downloadRequest === 'inProgress' && (
                <Icon
                  loading
                  name="circle notch"
                  size="large"
                />
              )}
              {downloadRequest === 'complete' && (
                <Icon
                  color="green"
                  name="checkmark"
                  size="large"
                />
              )}
              {downloadRequest === 'error' && (
                <span>
                  <Icon
                    color="red"
                    name="x"
                    size="large"
                  />
                  <Label>
                    {downloadError.data +
                      ` (HTTP ${downloadError.status} ${downloadError.statusText})`}
                  </Label>
                </span>
              )}
            </span>
          </Card.Content>
        )}
      </Card>
    );
  }
}

export default Directory;
