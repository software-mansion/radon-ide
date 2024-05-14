import { Variable } from "@vscode/debugadapter";
import { CDPPropertyDescriptor, inferDAPVariableValueForCDPRemoteObject } from "./cdp";
import { Logger } from "../Logger";

export class VariableStore {
  private _store: Map<number, CDPPropertyDescriptor[]> = new Map();
  //lowest free index
  private _currentLocalIndex: number = Math.pow(2, 32);
  public pausedCDPtoDAPObjectIdMap: Map<string, number> = new Map();
  public pausedDAPtoCDPObjectIdMap: Map<number, string> = new Map();

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
    if (this._store.has(id)) {
      properties = this._store.get(id) as CDPPropertyDescriptor[];
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
            variablesReference: Number(prop.value.objectId),
          };
        }
        return {
          name: prop.name,
          value,
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
  public push(object: CDPPropertyDescriptor[]): number {
    this._store.set(this._currentLocalIndex, object);
    return this._currentLocalIndex++;
  }

  /**
   * clears the store and resets the _currentLocalIndex.
   */
  public clear(): void {
    this._store.clear();
    this._currentLocalIndex = Math.pow(2, 32);
  }

  public adaptCDPObjectId(objectId: string) {
    let dapObjectID = this.pausedCDPtoDAPObjectIdMap.get(objectId);
    if (dapObjectID === undefined) {
      dapObjectID = this.pausedCDPtoDAPObjectIdMap.size + 1;
      this.pausedCDPtoDAPObjectIdMap.set(objectId, dapObjectID);
      this.pausedDAPtoCDPObjectIdMap.set(dapObjectID, objectId);
    }
    return dapObjectID;
  }

  private convertDAPObjectIdToCDP(dapObjectID: number) {
    return this.pausedDAPtoCDPObjectIdMap.get(dapObjectID);
  }
}
