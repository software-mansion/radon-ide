import React from 'react'
import LoadingView from '../../../Components/LoadingView'
import { useListTags } from '../../../Hooks/useListTags'
import { StyleSheet, View, ScrollView } from 'react-native'
import { Chip } from 'react-native-paper'

export const TagsList = () => {
  const { data, isFetching } = useListTags()

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
          <View style={styles.tagsContainer}>
            {data.map((tag: any, index: any) => (
              <Chip
                key={index}
                compact={false}
                style={{ margin: 4, backgroundColor: '#EFF4FF' }}
                // onPress={() => handleTagOnSelect(tag.name)}
                // selected={isTagSelected(tag.name)}
                // showSelectedOverlay={isTagSelected(tag.name)}
              >
                {tag.name} ({tag.quoteCount})
              </Chip>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 16,
    paddingBottom: 16,
  },
})
