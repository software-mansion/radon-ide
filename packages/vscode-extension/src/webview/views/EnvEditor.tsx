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
import "./EnvEditor.css";

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

  const updateEnv = (newEnv: Record<string, string>) => {
    setEnv(newEnv);
    onChange?.(newEnv);
  };

  const startEditing = (key: string | null) => {
    // Cancel any ongoing add operation
    if (showAddForm) {
      setShowAddForm(false);
    }
    if (key === null) {
      setShowAddForm(true);
    }

    setEditingKey(key);
    setEditingKeyValue(key ?? "");
    setEditingValue(key ? (env[key] ?? "") : "");
  };

  const save = () => {
    if (editingKeyValue && editingValue !== undefined) {
      const updatedEnv = { ...env };
      if (editingKey !== null && editingKey !== editingKeyValue) {
        delete updatedEnv[editingKey];
      }
      updatedEnv[editingKeyValue] = editingValue;
      updateEnv(updatedEnv);
    }
    setShowAddForm(false);
    setEditingKey(null);
    setEditingKeyValue("");
    setEditingValue("");
  };

  const cancel = () => {
    setShowAddForm(false);
    setEditingKey(null);
    setEditingKeyValue("");
    setEditingValue("");
  };

  const deleteEntry = (key: string) => {
    const newEnv = { ...env };
    delete newEnv[key];
    updateEnv(newEnv);
  };

  const entries: [string | null, string][] = Object.entries(env);

  if (showAddForm) {
    entries.push([null, ""]);
  }

  return (
    <>
      <VscodeTable className="env-editor-table">
        <VscodeTableHeader slot="header">
          <VscodeTableHeaderCell>Item</VscodeTableHeaderCell>
          <VscodeTableHeaderCell>Value</VscodeTableHeaderCell>
          <VscodeTableHeaderCell></VscodeTableHeaderCell>
        </VscodeTableHeader>
        <VscodeTableBody slot="body">
          {entries.map(([key, value]) => (
            <VscodeTableRow key={key} onDoubleClick={() => startEditing(key)}>
              <VscodeTableCell>
                {editingKey === key || key === null ? (
                  <VscodeTextfield
                    placeholder="Key"
                    data-testid="env-editor-key-input"
                    value={editingKeyValue}
                    data-no-submit
                    onInput={(e) => setEditingKeyValue((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        save();
                      }
                    }}
                  />
                ) : (
                  key
                )}
              </VscodeTableCell>
              <VscodeTableCell>
                {editingKey === key || key === null ? (
                  <VscodeTextfield
                    placeholder="Value"
                    data-testid="env-editor-value-input"
                    value={editingValue}
                    data-no-submit
                    onInput={(e) => setEditingValue((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        save();
                      }
                    }}
                  />
                ) : (
                  value
                )}
              </VscodeTableCell>
              <VscodeTableCell>
                <div className="env-editor-table-cell-actions">
                  {editingKey === key || key === null ? (
                    <>
                      <Button
                        disabled={!editingKeyValue}
                        onClick={save}
                        data-testid="env-editor-save-variable-button">
                        OK
                      </Button>
                      <Button onClick={cancel} secondary>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </VscodeTableCell>
            </VscodeTableRow>
          ))}
        </VscodeTableBody>
      </VscodeTable>
      {!showAddForm && (
        <Button data-testid="env-add-variable-button" onClick={() => startEditing(null)}>
          Add Variable
        </Button>
      )}
      <input type="hidden" name="env" value={JSON.stringify(env)} />
    </>
  );
}

export default EnvEditor;
