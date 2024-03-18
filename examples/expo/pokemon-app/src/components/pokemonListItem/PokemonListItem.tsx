import { View, Text, Image } from "react-native";
import React from "react";
import { Avatar, List, TouchableRipple } from "react-native-paper";
import { styles } from "./styles";
import lodash from "lodash";
import { useNavigation } from "@react-navigation/native";
import tinycolor from "tinycolor2";
import { ROUTES } from "../../config/navigationConfig";
import { useFavoritePokemons } from "../../contexts/favoritePokemons/FavoritePokemonsContext";
import IPokemon from "../../ts/interfaces/pokemon/pokemon";

type Props = {
  item: IPokemon;
};

const PokemonListItem = ({ item }: Props) => {
  const navigation = useNavigation();
  const {
    addFavoritePokemon,
    deleteFavoritePokemon,
    isPokemonFavorite,
  } = useFavoritePokemons();
  return (
    <List.Item
      style={styles.tile}
      title={lodash.capitalize(item.name)}
      titleStyle={styles.title}
      description={"#" + item.id.toString().padStart(3, "0")}
      left={() => (
        <View
          style={{
            backgroundColor:
              tinycolor(item.color)
                .setAlpha(0.5)
                .toRgbString() || "rgba (255, 255, 255, 0.5)",
            padding: 5,
            borderRadius: 50,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            style={{ width: 60, height: 60 }}
            source={{
              uri: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${item.id}.png`,
            }}
          />
        </View>
      )}
      right={() => (
        <TouchableRipple
          style={styles.right}
          onPress={() => {
            if (isPokemonFavorite(item.id)) {
              deleteFavoritePokemon(item.id);
            } else {
              addFavoritePokemon(item);
            }
          }}
        >
          <List.Icon
            icon={isPokemonFavorite(item.id) ? "star" : "star-outline"}
            color="gold"
          />
        </TouchableRipple>
      )}
      onPress={() =>
        navigation.navigate(ROUTES.POKEMON_DETAILS, { pokemon: item })
      }
    />
  );
};

export default PokemonListItem;
