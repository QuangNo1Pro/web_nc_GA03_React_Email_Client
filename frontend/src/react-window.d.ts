declare module 'react-window' {
  import { ComponentType, CSSProperties, ReactNode } from 'react';

  export interface ListChildComponentProps {
    index: number;
    style: CSSProperties;
    data?: any;
  }

  export interface FixedSizeListProps {
    children: ComponentType<ListChildComponentProps>;
    height: number;
    itemCount: number;
    itemSize: number;
    width: number | string;
    itemData?: any;
    overscanCount?: number;
    onItemsRendered?: (props: {
      overscanStartIndex: number;
      overscanStopIndex: number;
      visibleStartIndex: number;
      visibleStopIndex: number;
    }) => void;
    onScroll?: (props: {
      scrollDirection: 'forward' | 'backward';
      scrollOffset: number;
      scrollUpdateWasRequested: boolean;
    }) => void;
  }

  export class FixedSizeList extends React.Component<FixedSizeListProps> {}
}
