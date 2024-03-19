import { createContext, useContext } from "react";
import IPokemon from "ts/interfaces/pokemon/pokemon";

type PokemonsState = {
  pokemons: IPokemon[];
  fetchPokemons: () => void;
  fetchingPokemons: boolean;
};

const PokemonsContext = createContext<PokemonsState | null>(null);

const usePokemons = (): PokemonsState => {
  const context = useContext(PokemonsContext);
  if (!context) {
    throw new Error("usePokemons must be used within a PokemonProvider");
  }
  return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export { PokemonsContext, usePokemons };
