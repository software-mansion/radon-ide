import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import axios from "axios";
import { Chip, List } from "react-native-paper";
import { styles } from "./styles";
import PokemonStats from "./PokemonStats";
import IPokemon from "../../ts/interfaces/pokemon/pokemon";
import ISpecies from "../../ts/interfaces/pokemon/species";
import IPokemonType from "../../ts/interfaces/pokemon/type";
const PokemonDetails = ({ route, navigation }) => {
  const pokemon: IPokemon = route.params.pokemon;
  const { width, height } = useWindowDimensions();
  const [pokemonData, setPokemonData] = useState<IPokemon | null>(null);
  const [speciesData, setSpeciesData] = useState<ISpecies | null>(null);
  useEffect(() => {
    const fetchPokemonDetails = async () => {
      try {
        const pokemonDetails = await axios.get(
          `https://pokeapi.co/api/v2/pokemon/${pokemon.id}`
        );
        const speciesDetails = await axios.get(pokemonDetails.data.species.url);

        setPokemonData(pokemonDetails.data);
        setSpeciesData(speciesDetails.data);
      } catch (error) {
        console.error("Error fetching Pokemon details:", error);
      }
    };

    fetchPokemonDetails();
  }, [pokemon.id]);

  useEffect(() => {
    if (!route.params.appBarRight) return;
    navigation.setOptions({
      headerRight: () => route.params.appBarRight,
    });
  }, [navigation]);

  return (
    speciesData &&
    pokemonData && (
      <ScrollView>
        <View style={[styles.background]}>
          <View
            style={[
              styles.circle,
              {
                borderRadius: width * 2,
                width: width * 1.5,
                left: -0.25 * width,
                height: width * 1.5,
                top: -0.75 * width,
                backgroundColor: speciesData.color.name,
              },
            ]}
          ></View>
          <View style={styles.main}>
            <Image
              source={{
                uri:
                  pokemonData.sprites.other["official-artwork"].front_default,
              }}
              style={[
                styles.pokemonImage,
                {
                  width: 0.8 * width,
                  height: 0.8 * width,
                  // left: 0.1 * width,
                  // top: 0.15 * width,
                },
              ]}
            />
            <View style={styles.row}>
              <Text style={styles.pokemonName}>{pokemonData.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.pokemonIndex}>
                {"#" + pokemonData.id.toString().padStart(3, "0")}
              </Text>
            </View>
            {pokemonData && pokemonData.types && (
              <View style={styles.badges}>
                {pokemonData.types.map((type: IPokemonType) => (
                  <Chip
                    key={type.type.name}
                    style={[
                      styles.badge,
                      {
                        backgroundColor: speciesData.color.name,
                      },
                    ]}
                  >
                    {<Text style={styles.badgeText}>{type.type.name}</Text>}
                  </Chip>
                ))}
              </View>
            )}
          </View>
          <View style={styles.description}>
            <Text>
              Lorem, ipsum dolor sit amet consectetur adipisicing elit. Et
              ratione temporibus dolores, quia dolorum aspernatur. Animi tempore
              laborum odit, rem doloribus iure quasi dicta praesentium maiores
              vitae asperiores vero dolores?
            </Text>
          </View>
          <View style={styles.line}></View>
          <View style={styles.info}>
            <View style={styles.infoItem}>
              <View style={styles.infoItemTop}>
                <List.Icon icon="weight-kilogram" />
                <Text style={styles.infoItemTopText}>Weight</Text>
              </View>
              <Text style={styles.infoItemContent}>
                {pokemonData.weight} kg
              </Text>
            </View>

            <View style={styles.infoItem}>
              <View style={styles.infoItemTop}>
                <List.Icon icon="arrow-up-down" />
                <Text style={styles.infoItemTopText}>Height</Text>
              </View>
              <Text style={styles.infoItemContent}>{pokemonData.height} m</Text>
            </View>
          </View>
          <PokemonStats pokemon={pokemonData} />
        </View>
      </ScrollView>
    )
  );
};

export default PokemonDetails;
