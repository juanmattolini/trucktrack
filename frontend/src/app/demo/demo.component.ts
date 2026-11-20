import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import * as L from 'leaflet';

type TruckStatus = 'moving' | 'stopped' | 'offline';
type FleetFilter = 'all' | TruckStatus;

interface DemoTruck {
  id: string;
  name: string;
  driver: string;
  status: TruckStatus;
  speed: number;
  position: L.LatLngTuple;
  route: L.LatLngTuple[];
  routeIndex: number;
  destination: string;
}

const DEMO_TRUCKS: DemoTruck[] = [
  {
    id: 'TT-204',
    name: 'Camión 204',
    driver: 'Lucía Fernández',
    status: 'moving',
    speed: 62,
    position: [-34.6037, -58.3816],
    route: [
      [-34.6037, -58.3816],
      [-34.5998, -58.3745],
      [-34.595, -58.3688],
      [-34.5902, -58.3621]
    ],
    routeIndex: 0,
    destination: 'Centro de distribución'
  },
  {
    id: 'TT-118',
    name: 'Camión 118',
    driver: 'Mateo González',
    status: 'moving',
    speed: 48,
    position: [-34.6172, -58.3924],
    route: [
      [-34.6172, -58.3924],
      [-34.6128, -58.3861],
      [-34.6084, -58.3798],
      [-34.604, -58.3735]
    ],
    routeIndex: 0,
    destination: 'Depósito Sur'
  },
  {
    id: 'TT-305',
    name: 'Camión 305',
    driver: 'Sofía Martínez',
    status: 'stopped',
    speed: 0,
    position: [-34.5897, -58.4003],
    route: [
      [-34.5897, -58.4003],
      [-34.5862, -58.393],
      [-34.582, -58.386]
    ],
    routeIndex: 0,
    destination: 'Punto de entrega · Palermo'
  },
  {
    id: 'TT-072',
    name: 'Camión 072',
    driver: 'Tomás Ruiz',
    status: 'offline',
    speed: 0,
    position: [-34.626, -58.3718],
    route: [
      [-34.626, -58.3718],
      [-34.6215, -58.365],
      [-34.617, -58.3585]
    ],
    routeIndex: 0,
    destination: 'Base logística'
  },
  {
    id: 'TT-411',
    name: 'Camión 411',
    driver: 'Valentina Díaz',
    status: 'moving',
    speed: 71,
    position: [-34.5754, -58.3828],
    route: [
      [-34.5754, -58.3828],
      [-34.5794, -58.375],
      [-34.5832, -58.3672],
      [-34.587, -58.3594]
    ],
    routeIndex: 0,
    destination: 'Terminal Norte'
  }
];

const STATUS_LABELS: Record<TruckStatus, string> = {
  moving: 'En ruta',
  stopped: 'Detenido',
  offline: 'Sin conexión'
};

const STATUS_COLORS: Record<TruckStatus, string> = {
  moving: '#168b69',
  stopped: '#e69a36',
  offline: '#8a94a6'
};

@Component({
  selector: 'app-demo-root',
  standalone: true,
  templateUrl: './demo.component.html',
  styleUrl: './demo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoComponent implements AfterViewInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapCanvas = viewChild.required<ElementRef<HTMLDivElement>>('mapCanvas');
  private map?: L.Map;
  private readonly markers = new Map<string, L.Marker>();

  readonly trucks = signal<DemoTruck[]>(DEMO_TRUCKS.map(truck => ({ ...truck })));
  readonly activeFilter = signal<FleetFilter>('all');
  readonly searchTerm = signal('');
  readonly selectedTruckId = signal('TT-204');

  readonly filteredTrucks = computed(() => {
    const filter = this.activeFilter();
    const search = this.searchTerm().trim().toLocaleLowerCase();

    return this.trucks().filter(truck => {
      const isFilterMatch = filter === 'all' || truck.status === filter;
      const isSearchMatch = !search ||
        truck.name.toLocaleLowerCase().includes(search) ||
        truck.id.toLocaleLowerCase().includes(search) ||
        truck.driver.toLocaleLowerCase().includes(search);

      return isFilterMatch && isSearchMatch;
    });
  });

  readonly selectedTruck = computed(
    () => this.trucks().find(truck => truck.id === this.selectedTruckId()) ?? this.trucks()[0]
  );
  readonly movingCount = computed(() => this.trucks().filter(truck => truck.status === 'moving').length);
  readonly offlineCount = computed(() => this.trucks().filter(truck => truck.status === 'offline').length);
  readonly averageSpeed = computed(() => {
    const movingTrucks = this.trucks().filter(truck => truck.status === 'moving');
    return movingTrucks.length
      ? Math.round(movingTrucks.reduce((total, truck) => total + truck.speed, 0) / movingTrucks.length)
      : 0;
  });
  readonly todayLabel = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date());

  ngAfterViewInit(): void {
    this.initializeMap();
    interval(4500)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.advanceSimulation());
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  setSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  selectFilter(filter: FleetFilter): void {
    this.activeFilter.set(filter);
  }

  selectTruck(truck: DemoTruck): void {
    this.selectedTruckId.set(truck.id);
    this.map?.flyTo(truck.position, 14, { duration: 0.6 });
    this.markers.get(truck.id)?.openPopup();
  }

  centerMap(): void {
    if (!this.map) {
      return;
    }

    this.map.fitBounds(this.trucks().map(truck => truck.position), { padding: [40, 40] });
  }

  statusLabel(status: TruckStatus): string {
    return STATUS_LABELS[status];
  }

  private initializeMap(): void {
    this.map = L.map(this.mapCanvas().nativeElement, {
      center: [-34.6037, -58.3816],
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    for (const truck of this.trucks()) {
      L.polyline(truck.route, {
        color: STATUS_COLORS[truck.status],
        opacity: truck.status === 'offline' ? 0.35 : 0.6,
        weight: 4,
        dashArray: truck.status === 'offline' ? '7 8' : undefined
      }).addTo(this.map);

      const marker = L.marker(truck.position, {
        icon: this.createTruckIcon(truck.status)
      }).addTo(this.map);
      marker.bindPopup(this.popupContent(truck));
      marker.on('click', () => this.selectedTruckId.set(truck.id));
      this.markers.set(truck.id, marker);
    }
  }

  private advanceSimulation(): void {
    this.trucks.update(trucks => trucks.map(truck => {
      if (truck.status !== 'moving') {
        return truck;
      }

      const routeIndex = (truck.routeIndex + 1) % truck.route.length;
      const speedChange = routeIndex % 2 === 0 ? 3 : -2;
      const updatedTruck = {
        ...truck,
        routeIndex,
        position: truck.route[routeIndex],
        speed: Math.max(35, Math.min(78, truck.speed + speedChange))
      };

      const marker = this.markers.get(truck.id);
      marker?.setLatLng(updatedTruck.position);
      marker?.setPopupContent(this.popupContent(updatedTruck));
      return updatedTruck;
    }));
  }

  private createTruckIcon(status: TruckStatus): L.DivIcon {
    return L.divIcon({
      className: 'demo-marker',
      html: `<div class="marker-pin marker-${status}"><span class="material-icons">local_shipping</span></div>`,
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });
  }

  private popupContent(truck: DemoTruck): string {
    return `<strong>${truck.name}</strong><br>${STATUS_LABELS[truck.status]} · ${truck.speed} km/h`;
  }
}
