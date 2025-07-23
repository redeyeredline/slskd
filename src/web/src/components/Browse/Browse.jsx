/* eslint-disable promise/prefer-await-to-then */
import './Browse.css';
import * as users from '../../lib/users';
import Directory from './Directory';
import DirectoryTree from './DirectoryTree';
import * as lzString from 'lz-string';
import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { Button, Card, Icon, Input, Loader, Segment } from 'semantic-ui-react';

const initialState = {
  browseError: undefined,
  browseState: 'idle',
  browseStatus: 0,
  info: {
    directories: 0,
    files: 0,
    lockedDirectories: 0,
    lockedFiles: 0,
  },
  interval: undefined,
  selectedDirectory: {},
  selectedFiles: [],
  separator: '\\',
  tree: [],
  username: '',
};

class Browse extends Component {
  constructor(props) {
    super(props);

    this.state = initialState;
  }

  componentDidMount() {
    this.fetchStatus();
    this.loadState();
    this.setState(
      {
        interval: window.setInterval(this.fetchStatus, 500),
      },
      () => this.saveState(),
    );
    if (this.props.location.state?.user) {
      this.setState({ username: this.props.location.state.user }, this.browse);
    }

    document.addEventListener('keyup', this.keyUp, false);
  }

  componentWillUnmount() {
    clearInterval(this.state.interval);
    this.setState({ interval: undefined });
    document.removeEventListener('keyup', this.keyUp, false);
  }

  browse = () => {
    const username = this.inputtext.inputRef.current.value;

    // Clear any existing interval before starting a new browse
    if (this.state.interval) {
      clearInterval(this.state.interval);
    }

    this.setState(
      { browseError: undefined, browseState: 'pending', username },
      () => {
        // Start status polling for this browse
        this.setState({
          interval: window.setInterval(this.fetchStatus, 500),
        });

        // Use regular browse to get ALL directories, but implement lazy loading
        users
          .browse({ username })
          .then((response) => {
            // Ensure we have valid response data
            if (!response || typeof response !== 'object') {
              throw new Error('Invalid response from server');
            }

            let { directories = [] } = response;
            let { lockedDirectories = [] } = response;

            // Ensure directories and lockedDirectories are arrays
            if (!Array.isArray(directories)) {
              directories = [];
            }

            if (!Array.isArray(lockedDirectories)) {
              lockedDirectories = [];
            }

            // we need to know the directory separator. assume it is \ to start
            let separator;

            const directoryCount = directories.length;
            const fileCount = directories.reduce((accumulator, directory) => {
              // examine each directory as we process it to see if it contains \ or /, and set separator accordingly
              if (separator === undefined) {
                if (directory.name.includes('\\')) {
                  separator = '\\';
                } else if (directory.name.includes('/')) {
                  separator = '/';
                }
              }

              return accumulator + (directory.fileCount || 0);
            }, 0);

            const lockedDirectoryCount = lockedDirectories.length;
            const lockedFileCount = lockedDirectories.reduce((accumulator, directory) => {
              return accumulator + (directory.fileCount || 0);
            }, 0);

            // Create a lazy-loading tree structure
            const tree = this.getDirectoryTree({ directories, separator });

            this.setState(
              {
                browseState: 'complete',
              info: {
                directories: directoryCount,
                files: fileCount,
                lockedDirectories: lockedDirectoryCount,
                lockedFiles: lockedFileCount,
              },
              separator,
              tree,
              },
              () => this.saveState(),
            );
          })
          .catch((error) => {
            console.error('Browse failed:', error);

            // Enhanced error handling for massive users
            let errorMessage = error.message || `Failed to browse ${username}`;
            let originalError = null;
            
            if (error.response) {
              // Server responded with an error
              if (error.response.status === 408) {
                errorMessage = `Browse timed out - ${username} may have too many files (try using search to find specific folders)`;
              } else if (error.response.status === 500) {
                errorMessage = `Server error - ${username} may have too many files for the server to handle`;
              } else {
                errorMessage = error.response.data || errorMessage;
              }
              originalError = error;
            } else if (error.request) {
              // Request was made but no response received
              errorMessage = `No response from server - ${username} may have too many files causing a timeout`;
              originalError = error;
            }

            this.setState({
              browseError: {
                message: errorMessage,
                originalError,
              },
              browseState: 'error',
            });
          });
      },
    );
  };

  clear = () => {
    this.setState(initialState, () => {
      this.saveState();
      this.inputtext.focus();
    });
  };

  handleRetryBrowse = () => {
    this.setState({ browseError: undefined }, () => {
      this.browse();
    });
  };

  keyUp = (event) => (event.key === 'Escape' ? this.clear() : '');

  saveState = () => {
    this.inputtext.inputRef.current.value = this.state.username;
    this.inputtext.inputRef.current.disabled =
      this.state.browseState !== 'idle';

    const storeToLocalStorage = () => {
      try {
        localStorage.setItem(
          'soulseek-example-browse-state',
          lzString.compress(JSON.stringify(this.state)),
        );
      } catch (error) {
        console.error(error);
      }
    };

    // Shifting the compression and safe out of the current render loop to speed up responsiveness
    // requestIdleCallback is not supported in Safari hence we push to next tick using Promise.resolve
    if (window.requestIdleCallback) {
      window.requestIdleCallback(storeToLocalStorage);
    } else {
      Promise.resolve().then(storeToLocalStorage);
    }
  };

  loadState = () => {
    this.setState(
      (!this.props.location.state?.user &&
        JSON.parse(
          lzString.decompress(
            localStorage.getItem('soulseek-example-browse-state') || '',
          ),
        )) ||
        initialState,
    );
  };

  fetchStatus = () => {
    const { browseState, username } = this.state;
    if (browseState === 'pending' && username) {
      users
        .getBrowseStatus({ username })
        .then((response) => {
          this.setState({
            browseStatus: response.data,
          });
        })
        .catch((error) => {
          // If we get a 404, the browse is likely complete or the user is offline
          // Don't spam the console with these errors
          if (error.response?.status !== 404) {
            console.error('Browse status check failed:', error);
          }
        });
    }
  };

  getDirectoryTree = ({ directories, separator }) => {
    // Safety checks for directories array
    if (!Array.isArray(directories) || directories.length === 0) {
      return [];
    }

    // Filter out any invalid directory objects
    const validDirectories = directories.filter(
      (d) => d && d.name && typeof d.name === 'string',
    );

    if (validDirectories.length === 0) {
      return [];
    }

    // Sort directories by name for consistent ordering
    validDirectories.sort((a, b) => a.name.localeCompare(b.name));

    // For lazy loading, we want to show all directories but not pre-load their children
    // Instead, we'll create a flat structure where each directory can be expanded on-demand
    
    // Group directories by their top-level path
    const topLevelMap = new Map();
    
    for (const directory of validDirectories) {
      const parts = directory.name.split(separator);
      const topLevel = parts[0];
      
      if (!topLevelMap.has(topLevel)) {
        topLevelMap.set(topLevel, []);
      }
      topLevelMap.get(topLevel).push(directory);
    }
    
    // Create the tree structure with lazy loading support
    const tree = [];
    
    for (const [topLevel, dirs] of topLevelMap) {
      // Find the directory that represents this top level
      const topLevelDir = dirs.find(d => d.name === topLevel);
      
      // Always allow lazy loading for top-level directories
      tree.push({
        ...topLevelDir,
        hasChildren: true, // Always allow expansion
        children: [], // Start with empty children - will be loaded on demand
        childrenLoaded: false, // Flag to track if children have been loaded
        loading: false, // Flag to show loading state
      });
    }
    
    return tree;
  };

  selectDirectory = (directory) => {
    console.log('Selecting directory:', {
      name: directory.name,
      hasChildren: directory.hasChildren,
      childrenLoaded: directory.childrenLoaded,
      childrenCount: directory.children ? directory.children.length : 0,
    });

    // Always fetch directory contents from API to get both files and subdirectories
    console.log('Fetching directory contents from API for:', directory.name);
    this.setState(
      { selectedDirectory: { ...directory, children: [], loading: true } },
      () => {
        this.saveState();
        this.fetchDirectoryContents(directory.name);
      },
    );
  };

  fetchDirectoryContents = async (directoryPath) => {
    const { username } = this.state;
    if (!username || !directoryPath) return;

    console.log('Fetching directory contents for:', { username, directoryPath });

    try {
      // Use the directory-children endpoint instead, which we know works
      const response = await users.getDirectoryChildren({
        username,
        parent: directoryPath,
      });

      console.log('Directory children response:', response);

      if (response) {
        const files = response.files || [];
        const subdirectories = response.subdirectories || [];
        
        console.log('Extracted files:', files);
        console.log('Extracted subdirectories:', subdirectories);
        
        this.setState((previousState) => ({
          selectedDirectory: {
            ...previousState.selectedDirectory,
            files: files,
            subdirectories: subdirectories.map(dir => ({
              name: dir.name.split('\\').pop().split('/').pop(),
              fullPath: dir.name,
              fileCount: dir.fileCount || 0,
            })),
          },
        }), () => {
          console.log('Updated selectedDirectory:', this.state.selectedDirectory);
        });
      }
    } catch (error) {
      console.error('Failed to fetch directory contents:', error);
    }
  };

  handleSelectSubdirectory = (subdirectory) => {
    // Navigate to the subdirectory using the full path
    const fullPath =
      subdirectory.fullPath ||
      `${this.state.selectedDirectory.name}${this.state.separator}${subdirectory.name}`;
    this.fetchDirectoryContents(fullPath);
  };

  handleDeselectDirectory = () => {
    this.setState({ selectedDirectory: initialState.selectedDirectory }, () =>
      this.saveState(),
    );
  };

  triggerLazyLoadForDirectory = (directory) => {
    // This method will be called when we need to trigger lazy loading for a selected directory
    // We'll pass this to the DirectoryTree component
    if (this.directoryTreeRef && this.directoryTreeRef.triggerLazyLoad) {
      this.directoryTreeRef.triggerLazyLoad(directory);
    }
  };

  render() {
    const {
      browseError,
      browseState,
      browseStatus,
      info,
      selectedDirectory,
      separator,
      tree,
      username,
    } = this.state;
    const { locked, name } = selectedDirectory;
    const pending = browseState === 'pending';

    const emptyTree = !(tree && tree.length > 0);

    const files = (selectedDirectory.files || []).map((f) => ({
      ...f,
      filename: `${name}${separator}${f.filename}`,
    }));

    return (
      <div className="search-container">
        <Segment
          basic
          className="browse-segment"
          style={{ borderRadius: '10px', marginBottom: '20px' }}
        >
          <div className="browse-segment-icon">
            <Icon
              name="folder open"
              size="big"
            />
          </div>
          <Input
            action={
              !pending &&
              (browseState === 'idle'
                ? { icon: 'search', onClick: this.browse }
                : { color: 'red', icon: 'x', onClick: this.clear })
            }
            className="search-input"
            disabled={pending}
            input={
              <input
                data-lpignore="true"
                placeholder="Username"
                type="search"
              />
            }
            loading={pending}
            onKeyUp={(event) => (event.key === 'Enter' ? this.browse() : '')}
            placeholder="Username"
            ref={(input) => (this.inputtext = input)}
            size="big"
          />
        </Segment>
        {pending ? (
          <Loader
            active
            className="search-loader"
            inline="centered"
            size="big"
          >
            Downloaded {Math.round(browseStatus.percentComplete || 0)}% of
            Response
          </Loader>
        ) : (
          <div>
            {browseError ? (
              <div className="browse-error">
                <Icon
                  color="red"
                  name="warning circle"
                />
                <span>
                  {browseError.message || `Failed to browse ${username}`}
                </span>
                {browseError.originalError && (
                  <div
                    style={{
                      color: '#666',
                      fontSize: '0.9em',
                      marginTop: '0.5em',
                    }}
                  >
                    Try browsing a different user or check if the user is
                    online.
                  </div>
                )}
                <Button
                  onClick={this.handleRetryBrowse}
                  primary
                  size="small"
                  style={{ marginTop: '10px' }}
                >
                  <Icon name="refresh" />
                  Retry Browse
                </Button>
              </div>
            ) : (
              <div
                className="browse-container"
                style={{
                  borderRadius: '10px',
                  padding: '16px',
                }}
              >
                {emptyTree ? (
                  <div
                    style={{
                      alignItems: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: '40px 0',
                    }}
                  >
                    <Icon
                      name="folder open"
                      size="huge"
                      style={{ marginBottom: 16 }}
                    />
                    <div style={{ fontSize: '1.2em' }}>
                      No user share to display
                    </div>
                  </div>
                ) : (
                  <Card
                    basic
                    className="browse-tree-card"
                    style={{ borderRadius: '10px' }}
                  >
                    <Card.Content>
                      <Card.Header>
                        <Icon
                          color="green"
                          name="circle"
                        />
                        {username}
                      </Card.Header>
                      <Card.Meta className="browse-meta">
                        <span>
                          {`${info.files + info.lockedFiles} files in ${info.directories + info.lockedDirectories} directories (including ${info.lockedFiles} files in ${info.lockedDirectories} locked directories)`}{' '}
                          {/* eslint-disable-line max-len */}
                        </span>
                      </Card.Meta>
                      <Segment
                        basic
                        className="browse-folderlist"
                        style={{ borderRadius: '10px' }}
                      >
                        <DirectoryTree
                          ref={(ref) => (this.directoryTreeRef = ref)}
                          onSelect={(_, value) => this.selectDirectory(value)}
                          selectedDirectoryName={name}
                          tree={tree}
                          username={username}
                        />
                      </Segment>
                    </Card.Content>
                  </Card>
                )}
                {name && (
                  <Directory
                    files={files}
                    locked={locked}
                    marginTop={-20}
                    name={name}
                    onClose={this.handleDeselectDirectory}
                    onSelectSubdirectory={this.handleSelectSubdirectory}
                    separator={separator}
                    subdirectories={selectedDirectory.subdirectories || []}
                    username={username}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

export default withRouter(Browse);
