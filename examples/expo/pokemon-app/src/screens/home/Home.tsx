import React, { useState } from "react";
import { Appbar, BottomNavigation } from "react-native-paper";
import Loading from "../../components/loading/Loading";
import PokemonMap from "../../tabs/pokemonMap/PokemonMap";
import AllPokemons from "../../tabs/allPokemons/AllPokemons";
import FavoritePokemons from "../../tabs/favoritePokemons/FavoritePokemons";

const Home = () => {
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    {
      key: "pokemons",
      title: "All Pokemons",
      focusedIcon: "view-list",
      unfocusedIcon: "view-list-outline",
    },
    {
      key: "map",
      title: "Map",
      focusedIcon: "map",
      unfocusedIcon: "map-outline",
    },
    {
      key: "favorites",
      title: "Favorites",
      focusedIcon: "star",
      unfocusedIcon: "star-outline",
    },
  ]);

  const renderScene = BottomNavigation.SceneMap({
    pokemons: AllPokemons,
    map: PokemonMap,
    favorites: FavoritePokemons,
  });
  return (
    <>
      <Appbar.Header>
        <Appbar.Content title={routes[index].title} />
      </Appbar.Header>
      <Loading />
      <BottomNavigation
        navigationState={{ index, routes }}
        onIndexChange={setIndex}
        renderScene={renderScene}
      />
    </>
  );
};

export default Home;
