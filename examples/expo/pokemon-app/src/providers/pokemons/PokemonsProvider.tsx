import React, { useContext, useState, ReactNode, useEffect } from "react";
import axios from "axios";
import { PokemonsContext } from "../../contexts/pokemons/PokemonsContext";
import IPokemon from "../../ts/interfaces/pokemon/pokemon";
import { extractPokemontId } from "../../utils/utils";
// import { BACKEND_URL } from "@env";
interface PokemonsProviderProps {
  children: ReactNode;
}
const BACKEND_URL = "https://pokeapi.co/api/v2";
const PokemonsProvider: React.FC<PokemonsProviderProps> = ({ children }) => {
  const itemsPerFetch = 20;
  const [pokemons, setPokemons] = useState<IPokemon[]>([]);
  const [offset, setOffset] = useState<number>(0);
  const [fetchingPokemons, setFetchingPokemons] = useState<boolean>(false);

  const fetchPokemons = async () => {
    setFetchingPokemons(true);
    const response = await axios.get(`${BACKEND_URL}/pokemon`, {
      params: {
        limit: itemsPerFetch,
        offset: offset,
      },
    });

    const colors = await Promise.all(
      response.data.results.map(async (pokemon: any) => {
        const pokemonData = await axios.get(pokemon.url);
        const species = await axios.get(pokemonData.data.species.url);
        return species.data.color.name;
      })
    );

    setPokemons((pokemons) => [
      ...pokemons,
      ...response.data.results.map((pokemon: IPokemon, index: number) => ({
        name: pokemon.name,
        url: pokemon.url,
        id: extractPokemontId(pokemon.url),
        color: colors[index],
      })),
    ]);

    setOffset((offset) => offset + itemsPerFetch);
    setFetchingPokemons(false);
    // // fetch data of each pokemon
    // const pokemonsData = await Promise.all(
    //   response.data.results.map(async (pokemon: any) => {
    //     const pokemonData = await fetchPokemonData(pokemon.name);
    //     return pokemonData;
    //   })
    // );
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchPokemons();
    };

    fetchData();
  }, []);

  return (
    <PokemonsContext.Provider
      value={{ pokemons, fetchPokemons, fetchingPokemons }}
    >
      {children}
    </PokemonsContext.Provider>
  );
};

const usePokemons = () => {
  const context = useContext(PokemonsContext);
  if (!context) {
    throw new Error("usePokemons must be used within a PokemonProvider");
  }
  return context;
};

export { PokemonsProvider, usePokemons };
