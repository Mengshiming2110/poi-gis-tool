import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import MapScreen from './src/screens/MapScreen';

const Tab = createBottomTabNavigator();

function TasksPlaceholder() {
  return <MapScreen />;
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{ tabBarLabel: '地图采集', tabBarIcon: () => <Text>🗺</Text> }}
        />
        <Tab.Screen
          name="Tasks"
          component={TasksPlaceholder}
          options={{ tabBarLabel: '任务', tabBarIcon: () => <Text>📋</Text> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
