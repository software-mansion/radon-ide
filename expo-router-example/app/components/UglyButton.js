import { useState, useEffect } from "react";
import { Button } from "react-native";
import { preview } from "@preview";

export function UglyButton() {
  const [a, setA] = useState(0);
  if (a === 1) {
    useEffect(() => {
      console.log("useEffect");
    }, []);
  }

  return (
    <Button
      title="Throw error"
      onPress={() => {
        console.log("nice");
        setA(a + 1);
      }}
    />
  );
}

preview(<UglyButton />);
