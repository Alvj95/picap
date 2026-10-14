import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import type { LessonNode, Unit } from '@/data/hsk/types';
import { useProgressStore } from '@/store/useProgressStore';
import { useTheme } from '@/theme';
import { PathNode, type NodeState } from './PathNode';

interface Props {
  units: Unit[];
  onOpenNode: (node: LessonNode) => void;
}

/** Camino serpenteante de unidades. El desplazamiento horizontal sigue una onda senoidal. */
export function LearningPath({ units, onOpenNode }: Props) {
  const { c, type, spacing } = useTheme();
  const completed = useProgressStore((s) => s.completedNodeIds);

  // El primer nodo no completado (en orden global) es el "actual".
  const allNodes = units.flatMap((u) => u.nodes);
  const currentId = allNodes.find((n) => !completed.includes(n.id))?.id;
  const stateOf = (n: LessonNode): NodeState => (completed.includes(n.id) ? 'done' : n.id === currentId ? 'current' : 'locked');

  return (
    <View style={{ gap: spacing.lg }}>
      {units.map((unit, ui) => {
        const face = c[unit.color];
        const lipKey = `${unit.color}Lip` as const;
        const lipColor = lipKey in c ? c[lipKey as keyof typeof c] : c.primaryLip;
        return (
          <View key={unit.id}>
            <Card index={ui + 2} tint={face} style={{ borderColor: lipColor, borderBottomColor: lipColor }}>
              <Text style={[type.caption, styles.onBrand, { opacity: 0.85 }]}>
                HSK {unit.level} · UNIDAD {unit.index}
              </Text>
              <Text style={[type.title, styles.onBrand]}>{unit.title}</Text>
              <Text style={[type.body, styles.onBrand, { opacity: 0.9 }]}>{unit.description}</Text>
            </Card>
            <View style={{ paddingVertical: spacing.sm }}>
              {unit.nodes.map((node, i) => (
                <PathNode
                  key={node.id}
                  node={node}
                  state={stateOf(node)}
                  color={face}
                  lipColor={lipColor}
                  offsetX={Math.sin(i * 0.9) * 70}
                  onPress={() => onOpenNode(node)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  onBrand: { color: '#FFFFFF' },
});
