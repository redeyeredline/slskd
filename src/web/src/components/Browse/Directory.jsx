import * as transfers from '../../lib/transfers';
import * as users from '../../lib/users';
import { formatBytes } from '../../lib/util';
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

  /* eslint-disable complexity */
  download = async (username, files, selectedSubdirectories) => {
    this.setState({ downloadRequest: 'inProgress' }, async () => {
      // Show initial progress
      toast.info(
        `Starting download process for ${selectedSubdirectories.size} subdirectories...`,
      );
      try {
        // Create requests for selected files
        const fileRequests = (files || []).map(({ filename, size }) => ({
          filename,
          size,
        }));

        // Fetch contents of selected subdirectories and create file requests
        const subdirFileRequests = [];
        console.log(
          'Selected subdirectories:',
          Array.from(selectedSubdirectories),
        );

        for (const subdirName of selectedSubdirectories) {
          // Strip the file count from the subdirectory name (e.g., "The Conference of the Birds (2)" -> "The Conference of the Birds")
          const cleanSubdirName = subdirName.replace(/\s*\(\d+\)$/u, '');
          const subdirPath = `${this.props.name}${this.props.separator || '/'}${cleanSubdirName}`;
          console.log('Original subdirectory name:', subdirName);
          console.log('Clean subdirectory name:', cleanSubdirName);
          console.log('Fetching contents for subdirectory:', subdirPath);

          // Retry logic with exponential backoff
          let response = null;
          let lastError = null;
          const maxRetries = 3;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              response = await users.getDirectoryContents({
                directory: subdirPath,
                username,
              });

              console.log('Subdirectory response:', response);
              console.log('Response type:', typeof response);
              console.log('Response is array:', Array.isArray(response));
              console.log('Response length:', response?.length);
              if (response && Array.isArray(response) && response.length > 0) {
                console.log('First response item:', response[0]);
                console.log('First item files:', response[0]?.files);
                console.log(
                  'First item directories:',
                  response[0]?.directories,
                );
              }

              break; // Success, exit retry loop
            } catch (error) {
              lastError = error;
              console.warn(
                `Attempt ${attempt}/${maxRetries} failed for subdirectory ${cleanSubdirName}:`,
                error,
              );

              if (attempt < maxRetries) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = 2 ** (attempt - 1) * 1_000;
                console.log(`Retrying in ${delay}ms...`);
                toast.info(
                  `Retrying subdirectory '${cleanSubdirName}' in ${delay / 1_000}s (attempt ${attempt + 1}/${maxRetries})`,
                );
                await new Promise((resolve) => {
                  setTimeout(resolve, delay);
                });
              }
            }
          }

          if (response) {
            // Handle different response structures
            let discoveredFiles = [];

            if (Array.isArray(response)) {
              // Response is an array of directories
              console.log(
                'Response is array of directories, processing each...',
              );
              for (const directory of response) {
                if (directory.files && Array.isArray(directory.files)) {
                  discoveredFiles = discoveredFiles.concat(directory.files);
                  console.log(
                    `Found ${directory.files.length} files in directory: ${directory.name || 'unnamed'}`,
                  );
                }
              }
            } else if (response.files && Array.isArray(response.files)) {
              // Response is a single directory with files
              discoveredFiles = response.files;
              console.log(
                `Found ${discoveredFiles.length} files in single directory response`,
              );
            }

            // Add all files to the download requests
            if (discoveredFiles.length > 0) {
              console.log(
                `Found ${discoveredFiles.length} total files in subdirectory ${cleanSubdirName}`,
              );
              for (const file of discoveredFiles) {
                const fullPath = `${subdirPath}${this.props.separator || '/'}${file.filename}`;
                subdirFileRequests.push({
                  filename: fullPath,
                  size: file.size,
                });
                console.log('Added file to download:', fullPath, file.size);
              }
            } else {
              console.log('No files found in subdirectory:', cleanSubdirName);
            }
          } else {
            // All retries failed
            console.error(
              `Failed to fetch contents of subdirectory ${cleanSubdirName} after ${maxRetries} attempts:`,
              lastError,
            );

            // Show user-friendly error message
            const errorMessage =
              lastError.response?.status === 500
                ? `Timeout: User '${username}' is taking too long to respond for subdirectory '${cleanSubdirName}' after ${maxRetries} attempts. The user might be offline or the directory is very large.`
                : `Failed to fetch contents of subdirectory '${cleanSubdirName}' after ${maxRetries} attempts: ${lastError.message}`;

            console.warn(errorMessage);
            toast.warning(errorMessage);
            // Continue with other subdirectories even if one fails
          }
        }

        // Combine all requests
        const allRequests = [...fileRequests, ...subdirFileRequests];

        console.log('Total download requests:', allRequests.length);
        console.log('File requests:', fileRequests.length);
        console.log('Subdirectory file requests:', subdirFileRequests.length);
        console.log('All requests:', allRequests);

        if (allRequests.length > 0) {
          console.log('Submitting download request...');
          await transfers.download({ files: allRequests, username });
          console.log('Download request submitted successfully');
          toast.success(
            `Download request submitted successfully! ${allRequests.length} files queued for download.`,
          );
        } else {
          console.log('No files to download');
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
    const { locked, marginTop, name, onClose, username } = this.props;
    const {
      downloadError,
      downloadRequest,
      files,
      selectedSubdirectories,
      subdirectories,
    } = this.state;

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
      subdirectories.length > 0 &&
      subdirectories.every((subdir) => selectedSubdirectories.has(subdir.name));

    const someSubdirsSelected = subdirectories.some((subdir) =>
      selectedSubdirectories.has(subdir.name),
    );

    const handleSelectAllSubdirs = (checked) => {
      const newSelected = new Set(selectedSubdirectories);
      if (checked) {
        for (const subdir of subdirectories) {
          newSelected.add(subdir.name);
        }
      } else {
        for (const subdir of subdirectories) {
          newSelected.delete(subdir.name);
        }
      }

      this.setState({ selectedSubdirectories: newSelected });
    };

    // Remove useState/useEffect and use this.state.totalSelectedSubdirFiles/Bytes

    const hasContent = files.length > 0 || subdirectories.length > 0;

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
                {subdirectories.length > 0 && (
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
                        subdirectories,
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
