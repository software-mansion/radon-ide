import React, { useContext, useState, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FavoritePokemonsContext } from "../../contexts/favoritePokemons/FavoritePokemonsContext";
import IPokemon from "../../ts/interfaces/pokemon/pokemon";

interface PokemonsProviderProps {
  children: ReactNode;
}

const FavoritePokemonsProvider: React.FC<PokemonsProviderProps> = ({
  children,
}) => {
  const [favoritePokemons, setFavoritePokemons] = useState<IPokemon[]>([]);
  const [retrievingFavoritePokemons, setRetrievingFavoritePokemons] = useState<
    boolean
  >(false);

  const retrieveFavoritePokemons = async () => {
    setRetrievingFavoritePokemons(true);
    try {
      const value = await AsyncStorage.getItem("favoritePokemons");
      if (value !== null) {
        setFavoritePokemons(JSON.parse(value));
      }
    } catch (error) {
      console.log(error);
    }
    setRetrievingFavoritePokemons(false);
  };

  const addFavoritePokemon = async (pokemon: IPokemon) => {
    if (isPokemonFavorite(pokemon.id)) return;
    try {
      const updatedFavorites = [...favoritePokemons, pokemon];
      await AsyncStorage.setItem(
        "favoritePokemons",
        JSON.stringify(updatedFavorites)
      );
      setFavoritePokemons(updatedFavorites);
      console.log("added fav pokemon", favoritePokemons);
    } catch (error) {
      console.error("Error adding favorite Pokémon:", error);
    }
  };

  const deleteFavoritePokemon = async (pokemonId: number) => {
    try {
      const updatedFavorites = favoritePokemons.filter(
        (p) => p.id !== pokemonId
      );
      await AsyncStorage.setItem(
        "favoritePokemons",
        JSON.stringify(updatedFavorites)
      );
      setFavoritePokemons(updatedFavorites);
    } catch (error) {
      console.error("Error deleting favorite Pokémon:", error);
    }
  };

  const isPokemonFavorite = (pokemonId: number) => {
    return favoritePokemons.some((p) => p.id === pokemonId);
  };

  useEffect(() => {
    retrieveFavoritePokemons();
  }, []);

  return (
    <FavoritePokemonsContext.Provider
      value={{
        favoritePokemons,
        retrieveFavoritePokemons,
        addFavoritePokemon,
        deleteFavoritePokemon,
        retrievingFavoritePokemons,
        isPokemonFavorite,
      }}
    >
      {children}
    </FavoritePokemonsContext.Provider>
  );
};

const usePokemons = () => {
  const context = useContext(FavoritePokemonsContext);
  if (!context) {
    throw new Error("usePokemons must be used within a PokemonProvider");
  }
  return context;
};

export { FavoritePokemonsProvider, usePokemons };
