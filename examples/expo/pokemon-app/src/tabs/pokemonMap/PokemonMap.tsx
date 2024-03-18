import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { styles } from "./styles";
import { styles as listItemStyles } from "../../components/pokemonListItem/styles";
import {
  ActivityIndicator,
  Button,
  IconButton,
  List,
  Modal,
  Portal,
  TextInput,
} from "react-native-paper";
import axios from "axios";
import lodash from "lodash";
import { useNavigation } from "@react-navigation/native";
import { usePokemonPins } from "../../providers/pokemonPinsProvider/PokemonPinsProvider";
import { DEFAULT_LOCATION } from "../../config/mapConfig";
import { ROUTES } from "../../config/navigationConfig";
import IGeoLocation from "../../ts/interfaces/map/location";
import IPokemon from "../../ts/interfaces/pokemon/pokemon";

const PokemonMap = () => {
  const navigation = useNavigation();
  const {
    addPokemonPin,
    retrievePokemonPins,
    pokemonPins,
    deletePokemonPin,
    isPokemonPinSaved,
  } = usePokemonPins();
  const [currentLocation, setCurrentLocation] = useState<IGeoLocation | null>(
    null
  );
  const [pressLocation, setPressLocation] = useState<IGeoLocation | null>(null);
  const [locationFetched, setLocationFetched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [pokemon, setPokemon] = useState<IPokemon | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const showModal = () => setVisible(true);
  const hideModal = () => setVisible(false);

  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission to access location was denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      setLocationFetched(true);
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const handleLongPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setPressLocation({
      latitude: latitude,
      longitude: longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });
    showModal();
  };

  const handleSearch = () => {
    setLoading(true);
    axios
      .get(`https://pokeapi.co/api/v2/pokemon/${lodash.lowerCase(searchText)}`)
      .then((res) => {
        setPokemon(res.data);
        setErrorText(null);
      })
      .catch((error) => {
        console.error("Error getting pokemon:", error);
        setPokemon(null);
        setErrorText("Pokemon not found");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getLocation();
    retrievePokemonPins();
  }, []);

  return (
    <View style={styles.container}>
      <Portal>
        <Modal
          visible={visible}
          onDismiss={hideModal}
          contentContainerStyle={styles.modal}
        >
          <TextInput
            label="Search pokemon name"
            value={searchText}
            onChangeText={(text) => setSearchText(text)}
            style={{ marginTop: 10 }}
          />

          <View
            style={{
              paddingVertical: 10,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {loading && <ActivityIndicator size="small" />}
            {errorText && !loading && <Text>{errorText}</Text>}
          </View>

          {pokemon && !loading && (
            <List.Item
              style={listItemStyles.tile}
              title={lodash.capitalize(pokemon.name)}
              left={() => (
                <Image
                  source={{
                    uri: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`,
                  }}
                  style={{ width: 50, height: 50 }}
                />
              )}
              onPress={async () => {
                if (!pressLocation) return;
                await addPokemonPin(pokemon, pressLocation);
                await retrievePokemonPins();
              }}
            />
          )}
          <Button
            mode="contained"
            onPress={handleSearch}
            style={{ marginTop: 10 }}
          >
            Search
          </Button>
        </Modal>
      </Portal>
      {currentLocation && (
        <MapView
          style={styles.map}
          initialRegion={
            locationFetched
              ? currentLocation || DEFAULT_LOCATION
              : DEFAULT_LOCATION
          }
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={true}
          showsCompass={true}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
          onLongPress={handleLongPress}
        >
          {currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              title="Your location"
              description="You're here!"
            />
          )}
          {pokemonPins.map((pin) => (
            <Marker
              key={pin.id}
              coordinate={{
                latitude: pin.location.latitude,
                longitude: pin.location.longitude,
              }}
              title={lodash.capitalize(pin.pokemon.name)}
              onPress={() =>
                navigation.navigate(ROUTES.POKEMON_DETAILS, {
                  pokemon: pin.pokemon,
                  appBarRight: (
                    <IconButton
                      iconColor={"white"}
                      icon={
                        isPokemonPinSaved(pin.pokemon, pin.location)
                          ? "map-marker"
                          : "map-marker-outline"
                      }
                      onPress={async () => {
                        if (isPokemonPinSaved(pin.pokemon, pin.location)) {
                          await deletePokemonPin(pin.id);
                        } else {
                          await addPokemonPin(pin.pokemon, pin.location);
                        }
                        await retrievePokemonPins();
                      }}
                    />
                  ),
                })
              }
            >
              <Image
                source={{
                  uri: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pin.pokemon.id}.png`,
                  width: 30,
                  height: 30,
                }}
              />
            </Marker>
          ))}
        </MapView>
      )}
    </View>
  );
};

export default PokemonMap;
