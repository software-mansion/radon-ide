import React, { useContext, useState, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import IGeoLocation from "../../ts/interfaces/map/location";
import IPokemonPin from "../../ts/interfaces/map/pokemonPin";
import IPokemon from "../../ts/interfaces/pokemon/pokemon";

interface PokemonPinsProviderProps {
  children: ReactNode;
}

interface PokemonPinsContextProps {
  pokemonPins: IPokemonPin[];
  retrievingPokemonPins: boolean;
  retrievePokemonPins: () => void;
  addPokemonPin: (pokemon: IPokemon, location: IGeoLocation) => void;
  deletePokemonPin: (pinId: number) => void;
  isPokemonPinSaved: (pokemon: IPokemon, location: IGeoLocation) => boolean;
}

const PokemonPinsContext = React.createContext<
  PokemonPinsContextProps | undefined
>(undefined);

const PokemonPinsProvider: React.FC<PokemonPinsProviderProps> = ({
  children,
}) => {
  const [pokemonPins, setPokemonPins] = useState<IPokemonPin[]>([]);
  const [retrievingPokemonPins, setRetrievingPokemonPins] = useState<boolean>(
    false
  );

  const retrievePokemonPins = async () => {
    setRetrievingPokemonPins(true);
    try {
      const value = await AsyncStorage.getItem("pokemonPins");
      if (value !== null) {
        setPokemonPins(JSON.parse(value));
      }
      console.log("Retrieved Pokemon Pins:", pokemonPins);
    } catch (error) {
      console.log(error);
    }
    setRetrievingPokemonPins(false);
  };

  const addPokemonPin = async (pokemon: IPokemon, location: IGeoLocation) => {
    try {
      const id = await AsyncStorage.getItem("pokemonPinsId");
      const pin: IPokemonPin = {
        id: id ? parseInt(id) : 0,
        location: location,
        pokemon: {
          id: pokemon.id,
          name: pokemon.name,
          url: pokemon.url,
        },
      };

      const updatedPins = [...pokemonPins, pin];
      await AsyncStorage.setItem("pokemonPins", JSON.stringify(updatedPins));

      if (id) {
        await AsyncStorage.setItem(
          "pokemonPinsId",
          (parseInt(id) + 1).toString()
        );
      } else {
        await AsyncStorage.setItem("pokemonPinsId", "1");
      }
      setPokemonPins(updatedPins);
      console.log("Added Pokemon Pin:", pin);
    } catch (error) {
      console.error("Error adding Pokemon Pin:", error);
    }
  };

  const deletePokemonPin = async (pinId: number) => {
    try {
      const updatedPins = pokemonPins.filter((pin) => pin.id !== pinId);
      await AsyncStorage.setItem("pokemonPins", JSON.stringify(updatedPins));
      setPokemonPins(updatedPins);
      console.log("Deleted Pokemon Pin with ID:", pinId);
    } catch (error) {
      console.error("Error deleting Pokemon Pin:", error);
    }
  };

  const isPokemonPinSaved = (pokemon: IPokemon, location: IGeoLocation) => {
    return pokemonPins.some(
      (pin) =>
        pin.location.latitude === location.latitude &&
        pin.location.longitude === location.longitude &&
        pin.pokemon.id === pokemon.id
    );
  };

  useEffect(() => {
    retrievePokemonPins();
  }, []);

  return (
    <PokemonPinsContext.Provider
      value={{
        pokemonPins,
        retrievePokemonPins,
        addPokemonPin,
        deletePokemonPin,
        retrievingPokemonPins,
        isPokemonPinSaved,
      }}
    >
      {children}
    </PokemonPinsContext.Provider>
  );
};

const usePokemonPins = () => {
  const context = useContext(PokemonPinsContext);
  if (!context) {
    throw new Error("usePokemonPins must be used within a PokemonPinsProvider");
  }
  return context;
};

export { PokemonPinsProvider, usePokemonPins };
