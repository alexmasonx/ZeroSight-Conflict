import '../styles/MapGrid.css';

interface MapGridProps {
  size: number;
  highlight?: {
    x: number;
    y: number;
  } | null;
}

export function MapGrid({ size, highlight }: MapGridProps) {
  const rows = Array.from({ length: size }, (_, index) => index + 1);

  return (
    <div className="map-grid">
      {rows.map(row => (
        <div key={`row-${row}`} className="map-grid__row">
          {rows.map(column => {
            const isActive = highlight?.x === column && highlight?.y === row;
            return (
              <div
                key={`${row}-${column}`}
                className={`map-grid__cell ${isActive ? 'map-grid__cell--active' : ''}`}
              >
                <span>{column},{row}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
