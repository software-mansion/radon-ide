export const extractPokemontId = (url: string) => {
    const id = url.split("/")[6];
    return id;
}