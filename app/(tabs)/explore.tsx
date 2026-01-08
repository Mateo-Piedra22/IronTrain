import { StyleSheet, View } from 'react-native';
import { ExerciseList } from '../../components/ExerciseList';

export default function ExercisesScreen() {
    return (
        <View style={styles.container}>
            <ExerciseList />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
