import { View, Text } from "react-native";
import React, { useState } from "react";
import { ProgressBar, SegmentedButtons } from "react-native-paper";
import { pokemonStatsStyles as styles } from "./styles";
import { startCase, replace } from "lodash";
import IPokemon from "../../ts/interfaces/pokemon/pokemon";
type Props = {
  pokemon: IPokemon;
};

const PokemonStats = ({ pokemon }: Props) => {
  const [value, setValue] = useState("stats");
  const getStatColor = (statName: string): string => {
    const colorMap: Record<string, string> = {
      hp: "#66c2a5", // Green
      attack: "#fc8d62", // Salmon
      defense: "#8da0cb", // Lavender
      "special-attack": "#e78ac3", // Rose
      "special-defense": "#a6d854", // Olive
      speed: "#ffd92f", // Yellow
    };

    return colorMap[statName] || "gray";
  };
  return (
    <View style={styles.main}>
      <SegmentedButtons
        style={[
          styles.buttons,
          {
            backgroundColor: pokemon.color,
            borderColor: "green",
          },
        ]}
        value={value}
        onValueChange={setValue}
        buttons={[
          {
            value: "stats",
            label: "Stats",
            icon: "chart-bar",
          },
          {
            value: "abilities",
            label: "Abilities",
            icon: "shield",
          },
        ]}
      />
      {value === "stats" && (
        <View style={styles.statsItem}>
          {pokemon.stats?.map((stat, index) => (
            <View key={index} style={{ marginBottom: 10 }}>
              <View style={styles.statsItemTop}>
                <Text>{startCase(replace(stat.stat.name, "-", " "))}</Text>
                <Text style={{ textAlign: "right" }}>{stat.base_stat}</Text>
              </View>

              <ProgressBar
                progress={stat.base_stat / 100}
                color={getStatColor(stat.stat.name)}
                style={{
                  height: 10,
                  borderRadius: 10,
                  marginTop: 5,
                  opacity: 0.5,
                }}
              />
            </View>
          ))}
        </View>
      )}
      {/* {value === "abilities" && (
        
      )} */}
    </View>
  );
};

export default PokemonStats;
