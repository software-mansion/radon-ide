import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  background: {
    width: "100%",
  },
  circle: {
    borderRadius: -1,
    alignItems: "center",
    position: "absolute",
    opacity: 0.5,
    backgroundColor: "white",
    zIndex: 0,
  },
  pokemonImage: {
    zIndex: 100,
    resizeMode: "contain",
  },
  main: {
    marginTop: 50,
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  row: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pokemonName: {
    fontSize: 36,
    fontWeight: "bold",
    color: "black",
    textTransform: "capitalize",
  },
  pokemonIndex: {
    fontSize: 20,
  },
  badge: {
    marginRight: 10,
    elevation: 5,
    backgroundColor: "white",
    borderRadius: 100,
    borderWidth: 0,
    opacity: 0.5,
  },
  badgeText: {
    textTransform: "capitalize",
    color: "white",
  },
  badges: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    marginTop: 10,
  },
  description: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  line: {
    height: 0.25,
    backgroundColor: "#888",
    marginVertical: 10,
    marginHorizontal: 20,
  },
  info: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    paddingHorizontal: 20,
  },
  infoItem: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  infoItemTop: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  infoItemTopText: {
    marginLeft: 5,
    fontSize: 16,
  },
  infoItemContent: {
    fontSize: 30,
    fontWeight: "bold",
  },
  infoItemIcon: {},
});

export const pokemonStatsStyles = StyleSheet.create({
  main: {
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  buttons: {
    marginBottom: 20,
  },
  statsItem: {
    marginBottom: 20,
  },
  statsItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
