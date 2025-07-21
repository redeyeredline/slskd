import React, { useMemo, useState } from 'react';
import { FixedSizeList as VirtualList } from 'react-window';
import { Icon, List } from 'semantic-ui-react';

// Flatten the tree structure for virtual scrolling with collapse support
const flattenTree = (
  tree,
  level = 0,
  path = '',
  collapsedPaths = new Set(),
) => {
  const items = [];

  for (const item of tree) {
    const currentPath = path ? `${path}\\${item.name}` : item.name;
    const isCollapsed = collapsedPaths.has(currentPath);

    items.push({
      ...item,
      displayName: item.name.split('\\').pop().split('/').pop(),
      hasChildren: item.children && item.children.length > 0,
      isCollapsed,
      level,
      path: currentPath,
    });

    // Only add children if the folder is not collapsed
    if (item.children && item.children.length > 0 && !isCollapsed) {
      items.push(
        ...flattenTree(item.children, level + 1, currentPath, collapsedPaths),
      );
    }
  }

  return items;
};

const DirectoryTreeItem = ({
  item,
  onSelect,
  onToggleCollapse,
  selectedDirectoryName,
  style,
}) => {
  const isSelected = item.name === selectedDirectoryName;
  const isLocked = item.locked === true;

  const handleClick = (event) => {
    // Always select the directory when clicking on the folder name
    onSelect(event, item);
  };

  const handleSelect = (event) => {
    // Select the directory
    onSelect(event, item);
  };

  return (
    <div style={style}>
      <List.Item
        className={`browse-folderlist-item ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
        onClick={handleClick}
        style={{
          cursor: 'pointer',
          paddingLeft: `${item.level * 20 + 10}px`,
          userSelect: 'none',
        }}
      >
        <List.Icon
          className={`browse-folderlist-icon ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
          name={isLocked ? 'lock' : isSelected ? 'folder open' : 'folder'}
        />
        <List.Content>
          <List.Header
            className={`browse-folderlist-header ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
            style={{
              alignItems: 'center',
              display: 'flex',
              fontSize: '14px',
              fontWeight: isSelected ? 'bold' : 'normal',
              gap: '8px',
              opacity: isLocked ? 0.7 : 1,
            }}
          >
            {item.hasChildren && (
              <Icon
                name={item.isCollapsed ? 'chevron right' : 'chevron down'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCollapse(item.path);
                }}
                size="small"
                style={{
                  color: '#666',
                  cursor: 'pointer',
                  marginRight: '4px',
                }}
              />
            )}
            <button
              onClick={handleSelect}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                font: 'inherit',
                padding: 0,
                textAlign: 'left',
              }}
              type="button"
            >
              {item.displayName}
            </button>
            {item.hasChildren && (
              <span
                style={{ color: '#666', fontSize: '12px', marginLeft: 'auto' }}
              >
                ({item.children?.length || 0})
              </span>
            )}
          </List.Header>
        </List.Content>
      </List.Item>
    </div>
  );
};

const DirectoryTree = ({ onSelect, selectedDirectoryName, tree }) => {
  const [listHeight, setListHeight] = useState(500);
  const [collapsedPaths, setCollapsedPaths] = useState(new Set());
  const [controlBarHeight, setControlBarHeight] = useState(0);

  // Get all folder paths that have children
  const allFolderPaths = useMemo(() => {
    const getPaths = (treeData, path = '') => {
      const paths = [];
      for (const item of treeData) {
        const currentPath = path ? `${path}\\${item.name}` : item.name;
        if (item.children && item.children.length > 0) {
          paths.push(currentPath);
          paths.push(...getPaths(item.children, currentPath));
        }
      }

      return paths;
    };

    return getPaths(tree || []);
  }, [tree]);

  // Flatten the tree for virtual scrolling with collapse support
  const flattenedItems = useMemo(() => {
    return flattenTree(tree || [], 0, '', collapsedPaths);
  }, [collapsedPaths, tree]);

  // Toggle collapse state for a folder
  const handleToggleCollapse = (path) => {
    setCollapsedPaths((previous) => {
      const newSet = new Set(previous);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }

      return newSet;
    });
  };

  // Collapse all folders
  const handleCollapseAll = () => {
    setCollapsedPaths(new Set(allFolderPaths));
  };

  // Expand all folders
  const handleExpandAll = () => {
    setCollapsedPaths(new Set());
  };

  // Calculate item height (adjust based on your styling)
  const itemHeight = 40;

  // Render function for virtual list
  const renderItem = ({ index, style }) => {
    const item = flattenedItems[index];
    if (!item) return null;

    return (
      <DirectoryTreeItem
        item={item}
        onSelect={onSelect}
        onToggleCollapse={handleToggleCollapse}
        selectedDirectoryName={selectedDirectoryName}
        style={style}
      />
    );
  };

  // Update list height when component mounts
  React.useEffect(() => {
    const updateHeight = () => {
      const container = document.querySelector('.browse-folderlist');
      if (container) {
        // Calculate available height more accurately
        const containerRect = container.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const containerTop = containerRect.top;
        const availableHeight = viewportHeight - containerTop - 100; // Leave space for bottom content

        const height = Math.min(container.clientHeight - 80, availableHeight);
        setListHeight(Math.max(height, 400)); // Ensure minimum height
      }
    };

    // Update immediately and then with delays to ensure DOM is ready
    updateHeight();
    const timer = setTimeout(updateHeight, 50);
    const timer2 = setTimeout(updateHeight, 200);
    const timer3 = setTimeout(updateHeight, 500);

    window.addEventListener('resize', updateHeight);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener('resize', updateHeight);
    };
  }, [flattenedItems.length]); // Recalculate when items change

  if (!flattenedItems.length) {
    return (
      <div style={{ color: '#666', padding: '20px', textAlign: 'center' }}>
        No directories found
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      {/* Collapse/Expand All Controls */}
      {allFolderPaths.length > 0 && (
        <div
          ref={(element) => {
            if (element) {
              setControlBarHeight(element.offsetHeight);
            }
          }}
          style={{
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e0e0e0',
            borderRadius: '4px 4px 0 0',
            display: 'flex',
            fontSize: '12px',
            gap: '8px',
            marginBottom: '4px',
            padding: '8px 12px',
          }}
        >
          <button
            onBlur={(event) =>
              (event.target.style.backgroundColor = 'transparent')
            }
            onClick={handleCollapseAll}
            onFocus={(event) =>
              (event.target.style.backgroundColor = '#e9ecef')
            }
            onMouseOut={(event) =>
              (event.target.style.backgroundColor = 'transparent')
            }
            onMouseOver={(event) =>
              (event.target.style.backgroundColor = '#e9ecef')
            }
            style={{
              background: 'none',
              border: '1px solid #ccc',
              borderRadius: '4px',
              color: '#666',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 8px',
            }}
            type="button"
          >
            Collapse All
          </button>
          <button
            onBlur={(event) =>
              (event.target.style.backgroundColor = 'transparent')
            }
            onClick={handleExpandAll}
            onFocus={(event) =>
              (event.target.style.backgroundColor = '#e9ecef')
            }
            onMouseOut={(event) =>
              (event.target.style.backgroundColor = 'transparent')
            }
            onMouseOver={(event) =>
              (event.target.style.backgroundColor = '#e9ecef')
            }
            style={{
              background: 'none',
              border: '1px solid #ccc',
              borderRadius: '4px',
              color: '#666',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 8px',
            }}
            type="button"
          >
            Expand All
          </button>
          <span style={{ color: '#999', marginLeft: 'auto' }}>
            {flattenedItems.length} items
          </span>
        </div>
      )}

      <div
        style={{
          height:
            allFolderPaths.length > 0
              ? listHeight - controlBarHeight
              : listHeight,
        }}
      >
        <VirtualList
          height={
            allFolderPaths.length > 0
              ? listHeight - controlBarHeight
              : listHeight
          }
          itemCount={flattenedItems.length}
          itemSize={itemHeight}
          overscanCount={10}
          width="100%"
        >
          {renderItem}
        </VirtualList>
      </div>
    </div>
  );
};

export default DirectoryTree;
