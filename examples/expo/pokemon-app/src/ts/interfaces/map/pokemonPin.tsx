import IPokemon from "../pokemon/pokemon";
import IGeoLocation from "./location";

export default interface IPokemonPin {
  id: number;
  location: IGeoLocation;
  pokemon: IPokemon;
}
