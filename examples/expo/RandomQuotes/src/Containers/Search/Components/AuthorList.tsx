import LoadingView from '../../../Components/LoadingView'
import { useListAuthors } from '../../../Hooks/useListAuthors'
import React, { useCallback } from 'react'
import { ScrollView, View } from 'react-native'
import { Avatar, List, Text } from 'react-native-paper'

export const AuthorList = () => {
  const { data: authors, isFetching } = useListAuthors()
  const getProfileImageURL = useCallback((authorSlug: string, size = 200) => {
    const IMAGE_BASE = 'https://images.quotable.dev/profile'
    return `${IMAGE_BASE}/${size}/${authorSlug}.jpg`
  }, [])

  return (
    <View
      style={{
        paddingTop: 16,
        paddingLeft: 16,
        paddingRight: 16,
        flex: 1,
        backgroundColor: 'white',
      }}
    >
      {isFetching ? (
        <LoadingView />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{}}>
            {authors.map((author: any, index: any) => (
              <List.Accordion
                key={index}
                title={author.name}
                description={author.description}
                titleStyle={{
                  fontWeight: 'bold',
                }}
                descriptionStyle={{
                  fontWeight: '300',
                }}
                left={(props) => (
                  <Avatar.Image
                    {...props}
                    size={64}
                    source={{ uri: getProfileImageURL(author.slug) }}
                  />
                )}
                // right={(props) => <List.Icon {...props} color='red' icon='heart-outline' />}
              >
                <Text
                  style={{
                    paddingTop: 16,
                    paddingBottom: 16,
                  }}
                >
                  {author.bio}
                </Text>
                <Text
                  variant='titleSmall'
                  style={{
                    fontWeight: 'bold',
                    color: 'grey',
                    paddingBottom: 16,
                  }}
                >
                  Quote Count {author.quoteCount}
                </Text>
              </List.Accordion>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
