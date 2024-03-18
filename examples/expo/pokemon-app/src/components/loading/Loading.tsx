import { Modal, View } from "react-native";
import React from "react";
import { ActivityIndicator } from "react-native-paper";
import { styles } from "./styles";
import { useLoading } from "../../contexts/loading/LoadingContext";

const Loading = () => {
  const { loading } = useLoading();

  return (
    <Modal transparent visible={loading.state}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <ActivityIndicator size="large" animating={true} color="#0000ff" />
        </View>
      </View>
    </Modal>
  );
};

export default Loading;
