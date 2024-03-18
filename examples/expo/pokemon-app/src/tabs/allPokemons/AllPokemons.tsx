import PokemonsList from "../../components/pokemonsList/PokemonsList";
import { usePokemons } from "../../contexts/pokemons/PokemonsContext";
import { View } from "react-native";

const AllPokemons = ({}) => {
  const { pokemons, fetchPokemons, fetchingPokemons } = usePokemons();
  const onScrollEnd = () => {
    if (!fetchingPokemons) {
      fetchPokemons();
    }
  };

  return (
    <View>
      <PokemonsList
        pokemons={pokemons}
        onScrollEnd={onScrollEnd}
        loading={true}
      />
    </View>
  );
};

export default AllPokemons;
