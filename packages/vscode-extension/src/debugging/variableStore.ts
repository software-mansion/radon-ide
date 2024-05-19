import { Variable } from "@vscode/debugadapter";
import { CDPPropertyDescriptor, inferDAPVariableValueForCDPRemoteObject } from "./cdp";

const getVariableId = (() => {
  let last = 1;
  const max = 0x7fffffff - 1;
  return () => (last++ % max) + 1;
})();

export class VariableStore {
  private replVariables: Map<number, CDPPropertyDescriptor[]> = new Map();

  private pausedCDPtoDAPObjectIdMap: Map<string, number> = new Map();
  private pausedDAPtoCDPObjectIdMap: Map<number, string> = new Map();

  /**
   * If exist it returns a local variables if not it tries to fetch them from cdp.
   * @param id VariableId.
   * @param sendCDPMessage a method for fetching properties from cdp.
   */
  public async get(
    id: number,
    fetchProperties: (params: object) => Promise<any>
  ): Promise<Variable[]> {
    let properties: CDPPropertyDescriptor[];
    if (this.replVariables.has(id)) {
      properties = this.replVariables.get(id) as CDPPropertyDescriptor[];
    } else {
      const cdpObjectId = this.convertDAPObjectIdToCDP(id) || id.toString();
      properties = (
        await fetchProperties({
          objectId: cdpObjectId,
          ownProperties: true,
        })
      ).result as CDPPropertyDescriptor[];
    }

    const variables: Variable[] = properties
      .map((prop) => {
        if (prop.value === undefined) {
          return { name: prop.name, value: "undefined", variablesReference: 0 };
        }
        const value = inferDAPVariableValueForCDPRemoteObject(prop.value);
        if (prop.value.type === "object") {
          return {
            name: prop.name,
            value,
            type: "object",
            variablesReference: Number(prop.value.objectId),
          };
        }
        return {
          name: prop.name,
          value,
          type: prop.value?.type,
          variablesReference: 0,
        };
      })
      .filter((prop) => {
        return prop.name !== "__proto__";
      });

    return variables;
  }

  /**
   * Returns the id of stored property.
   */
  public pushReplVariable(object: CDPPropertyDescriptor[]) {
    const objectDapID = getVariableId();
    this.replVariables.set(objectDapID, object);
    return objectDapID;
  }

  /**
   * clears the variables store
   */
  public clearReplVariables() {
    this.replVariables.clear();
  }

  public clearPausedVariables() {
    this.pausedCDPtoDAPObjectIdMap = new Map();
    this.pausedDAPtoCDPObjectIdMap = new Map();
  }

  public adaptCDPObjectId(objectId: string) {
    let dapObjectID = this.pausedCDPtoDAPObjectIdMap.get(objectId);
    if (dapObjectID === undefined) {
      dapObjectID = getVariableId();
      this.pausedCDPtoDAPObjectIdMap.set(objectId, dapObjectID);
      this.pausedDAPtoCDPObjectIdMap.set(dapObjectID, objectId);
    }
    return dapObjectID;
  }

  private convertDAPObjectIdToCDP(dapObjectID: number) {
    return this.pausedDAPtoCDPObjectIdMap.get(dapObjectID);
  }
}
