import IPokemonStat from "./stat";
import IPokemonType from "./type";

export default interface IPokemon {
    id: number;
    name: string;
    url: string;
    weight?: number;
    height?: number;
    types?: IPokemonType[]
    stats?: IPokemonStat[]
    color?:string;
}