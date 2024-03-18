import { createContext, useContext } from "react";
import IPokemon from "ts/interfaces/pokemon/pokemon";

type FavoritePokemonsState = {
  favoritePokemons: IPokemon[];
  retrieveFavoritePokemons: () => void;
  retrievingFavoritePokemons: boolean;
  addFavoritePokemon: (pokemon: IPokemon) => void;
  deleteFavoritePokemon: (pokemonId: number) => void;
  isPokemonFavorite: (pokemonId: number) => boolean;
};

const FavoritePokemonsContext = createContext<FavoritePokemonsState | null>(
  null
);

const useFavoritePokemons = (): FavoritePokemonsState => {
  const context = useContext(FavoritePokemonsContext);
  if (!context) {
    throw new Error(
      "useFavoritePokemons must be used within a FavoritePokemonsProvider"
    );
  }
  return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export { FavoritePokemonsContext, useFavoritePokemons };
