import PokemonListItem from "../../components/pokemonListItem/PokemonListItem";
import React from "react";
import { FlatList, Image, Text, View } from "react-native";
import { ActivityIndicator, List } from "react-native-paper";
import IPokemon from "ts/interfaces/pokemon/pokemon";
type Props = {
  pokemons: IPokemon[];
  onScrollEnd?: () => void;
  loading: boolean;
};

const PokemonsList = ({ pokemons, onScrollEnd, loading }: Props) => {
  return (
    <View>
      <FlatList
        data={pokemons}
        renderItem={({ item }) => <PokemonListItem item={item} />}
        onEndReached={onScrollEnd}
        contentContainerStyle={{
          paddingBottom: 20,
        }}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator size="small" />
          ) : (
            <Text style={{ textAlign: "center" }}>No more pokemons</Text>
          )
        }
      />
    </View>
  );
};

export default PokemonsList;
