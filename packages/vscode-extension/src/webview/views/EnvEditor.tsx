import { useState } from "react";
import {
  VscodeTable,
  VscodeTableHeader,
  VscodeTableHeaderCell,
  VscodeTableBody,
  VscodeTableRow,
  VscodeTableCell,
  VscodeTextfield,
  VscodeButton as Button,
} from "@vscode-elements/react-elements";
import ToolbarButton from "../components/shared/VscodeToolbarButton";

interface EnvEditorProps {
  initialValue?: Record<string, string>;
  onChange?: (env: Record<string, string>) => void;
}

function EnvEditor({ initialValue, onChange }: EnvEditorProps) {
  const [env, setEnv] = useState<Record<string, string>>(initialValue ?? {});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingKeyValue, setEditingKeyValue] = useState<string>("");
  const [editingValue, setEditingValue] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newKey, setNewKey] = useState<string>("");
  const [newValue, setNewValue] = useState<string>("");

  const updateEnv = (newEnv: Record<string, string>) => {
    setEnv(newEnv);
    onChange?.(newEnv);
  };

  const startEditing = (key: string) => {
    // Cancel any ongoing add operation
    if (showAddForm) {
      setShowAddForm(false);
      setNewKey("");
      setNewValue("");
    }

    setEditingKey(key);
    setEditingKeyValue(key);
    setEditingValue(env[key] || "");
  };

  const saveEdit = () => {
    if (editingKey && editingKeyValue && editingValue !== undefined) {
      const { [editingKey]: removed, ...newEnv } = env;
      const updatedEnv = { ...newEnv, [editingKeyValue]: editingValue };
      updateEnv(updatedEnv);
    }
    setEditingKey(null);
    setEditingKeyValue("");
    setEditingValue("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditingKeyValue("");
    setEditingValue("");
  };

  const deleteEntry = (key: string) => {
    const { [key]: removed, ...newEnv } = env;
    updateEnv(newEnv);
  };

  const addEntry = () => {
    if (newKey && newValue) {
      const newEnv = { ...env, [newKey]: newValue };
      updateEnv(newEnv);
      setNewKey("");
      setNewValue("");
      setShowAddForm(false);
    }
  };

  const cancelAdd = () => {
    setNewKey("");
    setNewValue("");
    setShowAddForm(false);
  };

  const entries = Object.entries(env);

  return (
    <div>
      <VscodeTable>
        <VscodeTableHeader slot="header">
          <VscodeTableHeaderCell>Item</VscodeTableHeaderCell>
          <VscodeTableHeaderCell>Value</VscodeTableHeaderCell>
          <VscodeTableHeaderCell style={{ width: "100px" }}></VscodeTableHeaderCell>
        </VscodeTableHeader>
        <VscodeTableBody slot="body">
          {entries.map(([key, value]) => (
            <VscodeTableRow
              key={key}
              onDoubleClick={() => startEditing(key)}
              style={{
                cursor: editingKey === key ? "default" : "pointer",
                backgroundColor:
                  editingKey === key
                    ? "var(--vscode-list-activeSelectionBackground)"
                    : "transparent",
                color:
                  editingKey === key ? "var(--vscode-list-activeSelectionForeground)" : "inherit",
              }}>
              <VscodeTableCell>
                {editingKey === key ? (
                  <VscodeTextfield
                    value={editingKeyValue}
                    onInput={(e) => setEditingKeyValue((e.target as HTMLInputElement).value)}
                    style={{
                      backgroundColor: "var(--vscode-inputOption-activeBorder)",
                      color: "var(--vscode-inputOption-activeForeground)",
                    }}
                  />
                ) : (
                  key
                )}
              </VscodeTableCell>
              <VscodeTableCell>
                {editingKey === key ? (
                  <VscodeTextfield
                    value={editingValue}
                    onInput={(e) => setEditingValue((e.target as HTMLInputElement).value)}
                  />
                ) : (
                  value
                )}
              </VscodeTableCell>
              <VscodeTableCell style={{ textAlign: "right" }}>
                {editingKey === key ? (
                  <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                    <Button onClick={saveEdit}>OK</Button>
                    <Button onClick={cancelEdit} secondary>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                    <ToolbarButton
                      onClick={() => startEditing(key)}
                      title="Edit Environment Variable">
                      <span className="codicon codicon-edit" />
                    </ToolbarButton>
                    <ToolbarButton
                      onClick={() => deleteEntry(key)}
                      title="Remove Environment Variable">
                      <span className="codicon codicon-close" />
                    </ToolbarButton>
                  </div>
                )}
              </VscodeTableCell>
            </VscodeTableRow>
          ))}
        </VscodeTableBody>
      </VscodeTable>
      <div style={{ marginTop: "8px" }}>
        {showAddForm ? (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <VscodeTextfield
              placeholder="Key"
              value={newKey}
              onInput={(e) => setNewKey((e.target as HTMLInputElement).value)}
              style={{ flex: 1 }}
            />
            <VscodeTextfield
              placeholder="Value"
              value={newValue}
              onInput={(e) => setNewValue((e.target as HTMLInputElement).value)}
              style={{ flex: 1 }}
            />
            <Button onClick={addEntry} disabled={!newKey || !newValue}>
              OK
            </Button>
            <Button onClick={cancelAdd} secondary>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => {
              // Cancel any ongoing edit operation
              if (editingKey) {
                setEditingKey(null);
                setEditingKeyValue("");
                setEditingValue("");
              }
              setShowAddForm(true);
            }}>
            Add Variable
          </Button>
        )}
      </div>
      <input type="hidden" name="env" value={JSON.stringify(env)} />
    </div>
  );
}

export default EnvEditor;
