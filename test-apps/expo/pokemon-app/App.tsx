import { NavigationContainer } from "@react-navigation/native";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PaperProvider } from "react-native-paper";
import { useFonts } from "expo-font";
import { LoadingProvider } from "./src/providers/loading/LoadingProvider";
import { PokemonPinsProvider } from "./src/providers/pokemonPinsProvider/PokemonPinsProvider";
import { PokemonsProvider } from "./src/providers/pokemons/PokemonsProvider";
import Home from "./src/screens/home/Home";
import PokemonDetails from "./src/screens/pokemonDetails/PokemonDetails";
import { FavoritePokemonsProvider } from "./src/providers/favoritePokemons/FavoritePokemonsProvider";

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    "Montserrat-Bold": require("./assets/fonts/Montserrat-Bold.otf"),
    "Montserrat-Regular": require("./assets/fonts/Montserrat-Regular.otf"),
    "Montserrat-Light": require("./assets/fonts/Montserrat-Light.otf"),
    "Montserrat-Medium": require("./assets/fonts/Montserrat-Medium.otf"),
  });
  return (
    <SafeAreaProvider>
      <LoadingProvider>
        <PokemonsProvider>
          <FavoritePokemonsProvider>
            <PokemonPinsProvider>
              <PaperProvider>
                <NavigationContainer>
                  <Stack.Navigator>
                    <Stack.Screen
                      name="Home"
                      component={Home}
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Stack.Screen
                      name="PokemonDetails"
                      component={PokemonDetails}
                      options={{
                        headerStyle: {
                          backgroundColor: "transparent",
                        },
                        headerTitle: "",
                        headerTransparent: true,
                        headerTintColor: "#fff",
                      }}
                    />
                  </Stack.Navigator>
                </NavigationContainer>
              </PaperProvider>
            </PokemonPinsProvider>
          </FavoritePokemonsProvider>
        </PokemonsProvider>
      </LoadingProvider>
    </SafeAreaProvider>
  );
}
