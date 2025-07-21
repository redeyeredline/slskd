import './VirtualDirectoryTree.css';
import React, { useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { List as SemanticList } from 'semantic-ui-react';

const VirtualDirectoryTree = ({ onSelect, selectedDirectoryName, tree }) => {
  const [expandedItems, setExpandedItems] = useState(new Set());

  // Flatten the tree into a linear list for virtualization
  const flattenedItems = useMemo(() => {
    const items = [];

    const flatten = (nodes, level = 0) => {
      for (const node of nodes) {
        items.push({ ...node, level });
        if (
          expandedItems.has(node.name) &&
          node.children &&
          node.children.length > 0
        ) {
          flatten(node.children, level + 1);
        }
      }
    };

    flatten(tree);
    return items;
  }, [expandedItems, tree]);

  const toggleExpanded = (itemName) => {
    setExpandedItems((previous) => {
      const newSet = new Set(previous);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }

      return newSet;
    });
  };

  // eslint-disable-next-line react/no-unstable-nested-components
  const Row = ({ index, style }) => {
    const item = flattenedItems[index];
    const isExpanded = expandedItems.has(item.name);
    const hasChildren = item.children && item.children.length > 0;
    const isSelected = item.name === selectedDirectoryName;

    return (
      <div style={style}>
        <SemanticList.Item
          className={`virtual-tree-item level-${item.level} ${isSelected ? 'selected' : ''} ${item.locked ? 'locked' : ''}`}
          style={{ paddingLeft: `${item.level * 20 + 10}px` }}
        >
          <SemanticList.Icon
            className={`virtual-tree-icon ${isSelected ? 'selected' : ''} ${item.locked ? 'locked' : ''}`}
            name={
              item.locked === true
                ? 'lock'
                : hasChildren
                  ? isExpanded
                    ? 'folder open'
                    : 'folder'
                  : 'file'
            }
            onClick={() =>
              hasChildren && !item.locked && toggleExpanded(item.name)
            }
            style={{
              cursor: hasChildren && !item.locked ? 'pointer' : 'default',
            }}
          />
          <SemanticList.Content>
            <SemanticList.Header
              className={`virtual-tree-header ${isSelected ? 'selected' : ''} ${item.locked ? 'locked' : ''}`}
              onClick={() => onSelect(null, item)}
            >
              {item.name.split('\\').pop().split('/').pop()}
            </SemanticList.Header>
          </SemanticList.Content>
        </SemanticList.Item>
      </div>
    );
  };

  if (!flattenedItems.length) {
    return <div className="no-items">No directories to display</div>;
  }

  return (
    <div className="virtual-directory-tree">
      <List
        height={400}
        itemCount={flattenedItems.length}
        itemSize={40}
        width="100%"
      >
        {Row}
      </List>
    </div>
  );
};

export default VirtualDirectoryTree;
 