import {
  CodeEditor,
  LoaderSegment,
  ShrinkableButton,
  Switch,
} from "../../Shared";
import DebugModal from "./DebugModal";
import EditModal from "./EditModal";
import React, { useEffect, useState } from "react";
import { Divider } from "semantic-ui-react";
import YAML from "yaml";

const DebugButton = ({
  debug,
  remoteConfiguration,
  setDebugModal,
  ...props
}) => {
  if (!remoteConfiguration || !debug) return null;

  return (
    <ShrinkableButton
      icon="bug"
      mediaQuery="(max-width: 516px)"
      onClick={() => setDebugModal(true)}
      {...props}
    >
      Debug View
    </ShrinkableButton>
  );
};

const EditButton = ({ remoteConfiguration, setEditModal, ...props }) => {
  if (!remoteConfiguration) {
    return (
      <ShrinkableButton disabled icon="lock" mediaQuery="(max-width: 516px)">
        Remote Configuration Disabled
      </ShrinkableButton>
    );
  }

  return (
    <ShrinkableButton
      icon="edit"
      mediaQuery="(max-width: 516px)"
      onClick={() => setEditModal(true)}
      primary
      {...props}
    >
      Edit
    </ShrinkableButton>
  );
};

const Options = ({ options, theme }) => {
  const [debugModal, setDebugModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [contents, setContents] = useState();

  useEffect(() => {
    setTimeout(() => {
      setContents(
        YAML.stringify(options, { simpleKeys: true, sortMapEntries: false }),
      );
    }, 250);
  }, [options]);

  const { debug, remoteConfiguration } = options;

  return (
    <>
      <div className="header-buttons">
        <DebugButton
          debug={debug}
          disabled={!contents}
          remoteConfiguration={remoteConfiguration}
          setDebugModal={setDebugModal}
        />
        <EditButton
          disabled={!contents}
          remoteConfiguration={remoteConfiguration}
          setEditModal={setEditModal}
        />
      </div>
      <Divider />
      <Switch loading={!contents && <LoaderSegment />}>
        <CodeEditor
          basicSetup={false}
          editable={false}
          theme={theme}
          value={contents}
        />
      </Switch>
      <DebugModal
        onClose={() => setDebugModal(false)}
        open={debugModal}
        theme={theme}
      />
      <EditModal
        onClose={() => setEditModal(false)}
        open={editModal}
        theme={theme}
      />
    </>
  );
};

export default Options;
