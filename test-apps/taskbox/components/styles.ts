import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  listItems: {
    backgroundColor: "white",
    minHeight: 288,
  },
  wrapperMessage: {
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    flex: 1,
  },
  titleMessage: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
    color: "#555",
  },
  subtitleMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
  },
  listItem: {
    flexDirection: "row",
    flexWrap: "nowrap",
    height: 48,
    width: "100%",
    backgroundColor: "white",
    alignItems: "center",
    paddingHorizontal: 10,
    justifyContent: "space-around",
  },
  listItemInputTask: {
    backgroundColor: "transparent",
    flex: 1,
    padding: 10,
    fontSize: 14,
  },
  listItemInputTaskArchived: {
    color: "#aaa",
    flex: 1,
    padding: 10,
    fontSize: 14,
  },
  loadingItem: {
    alignItems: "center",
    backgroundColor: "white",
    flexWrap: "nowrap",
    flexDirection: "row",
    flex: 1,
    height: 48,
    justifyContent: "space-around",
    paddingHorizontal: 10,
    width: "100%",
  },
  glowCheckbox: {
    borderColor: "#eee",
    borderStyle: "solid",
    borderWidth: 2,
    borderRadius: 1,
    backgroundColor: "#eee",
    color: "transparent",
    height: 24,
    width: 24,
  },
  glowText: {
    backgroundColor: "#eee",
    color: "transparent",
    padding: 10,
    fontSize: 14,
    height: 24,
  },
  container: {
    paddingHorizontal: 10,
    paddingVertical: 22,
  },
});
