import React from 'react'
import { View, ScrollView } from 'react-native'
import { Text, Card, IconButton } from 'react-native-paper'

export const BookmarkScreen = () => {
  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: '#EFF4FF',
          paddingTop: 75,
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <Text
          variant='headlineLarge'
          style={{
            fontWeight: 'bold',
            letterSpacing: 1,
            color: 'slategray',
          }}
        >
          Loved Quotes
        </Text>

        <ScrollView
          style={{
            marginTop: 16,
          }}
        >
          <Card
            theme={{ roundness: 7 }}
            style={{
              backgroundColor: 'white',
              shadowOpacity: 0,
              shadowRadius: 0,
              marginTop: 8,
            }}
          >
            <Card.Content
              style={{
                gap: 16,
                paddingTop: 40,
                paddingBottom: 24,
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                }}
              >
                <IconButton
                  icon='share-outline'
                  iconColor='grey'
                  size={24}
                  onPress={() => console.log('Pressed')}
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                />
              </View>
              <Text
                variant='bodyLarge'
                style={{
                  color: 'grey',
                  textTransform: 'lowercase',
                }}
              >
                To succeed in your mission, you must have single-minded devotion to your goal.
              </Text>

              <Text
                variant='bodyLarge'
                style={{
                  fontWeight: 'bold',
                  textAlign: 'center',
                  textTransform: 'capitalize',
                }}
              >
                Abdul Kalam
              </Text>
            </Card.Content>
          </Card>
        </ScrollView>
      </View>
    </>
  )
}
