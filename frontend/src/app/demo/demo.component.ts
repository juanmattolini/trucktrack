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
type DemoAlertType = 'speed' | 'offline' | 'geofence-entry' | 'geofence-exit';

interface DemoTruck {
  id: string;
  name: string;
  driver: string;
  plate: string;
  status: TruckStatus;
  speed: number;
  position: L.LatLngTuple;
  route: L.LatLngTuple[];
  routeIndex: number;
  destination: string;
  lastUpdatedAt: number;
}

interface DemoGeofence {
  id: string;
  name: string;
  center: L.LatLngTuple;
  radius: number;
  color: string;
}

interface DemoAlert {
  id: number;
  type: DemoAlertType;
  truckId: string;
  title: string;
  detail: string;
  createdAt: number;
}

const DEMO_TRUCKS: Omit<DemoTruck, 'lastUpdatedAt'>[] = [
  {
    id: 'TT-204',
    name: 'Camión 204',
    driver: 'Lucía Fernández',
    plate: 'AE 204 LK',
    status: 'moving',
    speed: 64,
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
    plate: 'AF 118 QP',
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
    plate: 'AD 305 XM',
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
    plate: 'AC 072 BV',
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
    plate: 'AG 411 RT',
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

const DEMO_GEOFENCES: DemoGeofence[] = [
  {
    id: 'transfer',
    name: 'Zona de transferencia',
    center: [-34.6128, -58.3861],
    radius: 700,
    color: '#7b6fc5'
  },
  {
    id: 'north',
    name: 'Área urbana norte',
    center: [-34.5832, -58.3672],
    radius: 550,
    color: '#5086bd'
  }
];

const INITIAL_ALERTS: Omit<DemoAlert, 'createdAt' | 'id'>[] = [
  {
    type: 'speed',
    truckId: 'TT-411',
    title: 'Velocidad sobre el límite',
    detail: '71 km/h · límite de 65 km/h'
  },
  {
    type: 'offline',
    truckId: 'TT-072',
    title: 'Unidad sin conexión',
    detail: 'Sin señal desde hace 12 min'
  },
  {
    type: 'geofence-entry',
    truckId: 'TT-118',
    title: 'Entrada a geocerca',
    detail: 'Zona de transferencia'
  },
  {
    type: 'geofence-exit',
    truckId: 'TT-204',
    title: 'Salida de geocerca',
    detail: 'Área de entrega norte'
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

const ALERT_TITLES: Record<DemoAlertType, string> = {
  speed: 'Velocidad sobre el límite',
  offline: 'Unidad sin conexión',
  'geofence-entry': 'Entrada a geocerca',
  'geofence-exit': 'Salida de geocerca'
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
  private readonly routeLines = new Map<string, L.Polyline>();
  private readonly routeProgressLines = new Map<string, L.Polyline>();
  private readonly geofenceMembership = new Map<string, Set<string>>();
  private readonly speedingTrucks = new Set<string>();
  private alertId = 0;
  private mapStatusColors: Record<TruckStatus, string> = { ...STATUS_COLORS };

  readonly trucks = signal<DemoTruck[]>(DEMO_TRUCKS.map(truck => ({
    ...truck,
    position: [...truck.position] as L.LatLngTuple,
    route: [...truck.route],
    lastUpdatedAt: Date.now() - (truck.status === 'offline' ? 12 * 60_000 : 0)
  })));
  readonly alerts = signal<DemoAlert[]>(INITIAL_ALERTS.map((alert, index) => ({
    ...alert,
    id: -(index + 1),
    createdAt: Date.now() - (index * 3 + 2) * 60_000
  })));
  readonly activeFilter = signal<FleetFilter>('all');
  readonly searchTerm = signal('');
  readonly selectedTruckId = signal('TT-204');
  readonly isPlaying = signal(true);
  readonly currentTime = signal(Date.now());
  readonly speedLimit = 65;

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
  readonly selectedRouteProgress = computed(() => {
    const truck = this.selectedTruck();
    return truck?.route.length ? Math.round((truck.routeIndex / (truck.route.length - 1)) * 100) : 0;
  });
  readonly geofenceCount = computed(() => DEMO_GEOFENCES.length);
  readonly alertCount = computed(() => this.alerts().length);
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
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.currentTime.set(Date.now()));
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
    this.updateSelectedRouteStyles();
  }

  togglePlayback(): void {
    this.isPlaying.update(isPlaying => !isPlaying);
  }

  stepPlayback(direction: -1 | 1): void {
    const truck = this.selectedTruck();
    if (!truck) {
      return;
    }

    const nextIndex = (truck.routeIndex + direction + truck.route.length) % truck.route.length;
    this.seekTruckTo(truck, nextIndex);
  }

  seekPlayback(event: Event): void {
    const truck = this.selectedTruck();
    const index = Number((event.target as HTMLInputElement).value);
    if (!truck || !Number.isInteger(index)) {
      return;
    }

    this.seekTruckTo(truck, Math.max(0, Math.min(truck.route.length - 1, index)));
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

  connectionLabel(status: TruckStatus): string {
    return status === 'offline' ? 'Sin señal' : 'Conectado';
  }

  lastUpdateLabel(truck: DemoTruck): string {
    if (truck.status === 'offline') {
      return 'Hace 12 min';
    }

    const seconds = Math.floor((this.currentTime() - truck.lastUpdatedAt) / 1000);
    return seconds < 10 ? 'Ahora' : `Hace ${seconds} s`;
  }

  alertIcon(type: DemoAlertType): string {
    switch (type) {
      case 'speed':
        return 'speed';
      case 'offline':
        return 'wifi_off';
      case 'geofence-entry':
        return 'login';
      case 'geofence-exit':
        return 'logout';
    }
  }

  alertTime(createdAt: number): string {
    const minutes = Math.floor((this.currentTime() - createdAt) / 60_000);
    return minutes < 1 ? 'Ahora' : `Hace ${minutes} min`;
  }

  private initializeMap(): void {
    const mapStyles = getComputedStyle(this.mapCanvas().nativeElement);
    this.mapStatusColors = {
      moving: mapStyles.getPropertyValue('--status-moving-color').trim() || STATUS_COLORS.moving,
      stopped: mapStyles.getPropertyValue('--status-stopped-color').trim() || STATUS_COLORS.stopped,
      offline: mapStyles.getPropertyValue('--status-offline-color').trim() || STATUS_COLORS.offline
    };

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

    for (const geofence of DEMO_GEOFENCES) {
      L.circle(geofence.center, {
        radius: geofence.radius,
        color: geofence.color,
        weight: 2,
        dashArray: '6 5',
        fillColor: geofence.color,
        fillOpacity: 0.1
      }).addTo(this.map)
        .bindTooltip(geofence.name, {
          permanent: true,
          direction: 'center',
          className: 'demo-geofence-label'
        });
    }

    for (const truck of this.trucks()) {
      const isSelected = truck.id === this.selectedTruckId();
      const routeLine = L.polyline(truck.route, {
        color: this.mapStatusColors[truck.status],
        opacity: truck.status === 'offline' ? 0.3 : isSelected ? 0.55 : 0.18,
        weight: isSelected ? 4 : 3,
        dashArray: truck.status === 'offline' ? '7 8' : undefined
      }).addTo(this.map);
      this.routeLines.set(truck.id, routeLine);

      const routeProgress = L.polyline(truck.route.slice(0, truck.routeIndex + 1), {
        color: this.mapStatusColors[truck.status],
        opacity: isSelected ? 0.9 : 0.35,
        weight: isSelected ? 4 : 2
      }).addTo(this.map);
      this.routeProgressLines.set(truck.id, routeProgress);

      const marker = L.marker(truck.position, {
        icon: this.createTruckIcon(truck.status)
      }).addTo(this.map);
      marker.bindPopup(this.popupContent(truck));
      marker.on('click', () => {
        this.selectedTruckId.set(truck.id);
        this.updateSelectedRouteStyles();
      });
      this.markers.set(truck.id, marker);
      this.geofenceMembership.set(truck.id, this.geofenceIdsAt(truck.position));
      if (truck.speed > this.speedLimit) {
        this.speedingTrucks.add(truck.id);
      }
    }
  }

  private advanceSimulation(): void {
    if (!this.isPlaying()) {
      return;
    }

    const updatedTrucks = this.trucks().map(truck => {
      if (truck.status === 'offline') {
        return truck;
      }

      const routeIndex = truck.status === 'moving'
        ? (truck.routeIndex + 1) % truck.route.length
        : truck.routeIndex;
      const speedChange = routeIndex % 2 === 0 ? 3 : -2;
      const updatedTruck = {
        ...truck,
        routeIndex,
        position: truck.status === 'moving' ? truck.route[routeIndex] : truck.position,
        speed: truck.status === 'moving' ? Math.max(35, Math.min(78, truck.speed + speedChange)) : 0,
        lastUpdatedAt: Date.now()
      };

      this.syncTruckOnMap(updatedTruck);
      this.checkGeofenceTransitions(truck, updatedTruck.position);
      this.checkSpeedAlert(updatedTruck);
      return updatedTruck;
    });

    this.trucks.set(updatedTrucks);
  }

  private seekTruckTo(truck: DemoTruck, routeIndex: number): void {
    const updatedTruck = {
      ...truck,
      routeIndex,
      position: truck.route[routeIndex],
      lastUpdatedAt: Date.now()
    };

    this.trucks.update(trucks => trucks.map(current =>
      current.id === truck.id ? updatedTruck : current
    ));
    this.syncTruckOnMap(updatedTruck);
    this.checkGeofenceTransitions(truck, updatedTruck.position);
  }

  private syncTruckOnMap(truck: DemoTruck): void {
    const marker = this.markers.get(truck.id);
    marker?.setLatLng(truck.position);
    marker?.setPopupContent(this.popupContent(truck));
    this.routeProgressLines.get(truck.id)?.setLatLngs(truck.route.slice(0, truck.routeIndex + 1));
  }

  private checkGeofenceTransitions(previousTruck: DemoTruck, position: L.LatLngTuple): void {
    const previousZones = this.geofenceMembership.get(previousTruck.id) ?? new Set<string>();
    const currentZones = this.geofenceIdsAt(position);

    for (const geofence of DEMO_GEOFENCES) {
      const isPreviouslyInside = previousZones.has(geofence.id);
      const isInside = currentZones.has(geofence.id);
      if (!isPreviouslyInside && isInside) {
        this.addAlert('geofence-entry', previousTruck, geofence.name);
      } else if (isPreviouslyInside && !isInside) {
        this.addAlert('geofence-exit', previousTruck, geofence.name);
      }
    }

    this.geofenceMembership.set(previousTruck.id, currentZones);
  }

  private geofenceIdsAt(position: L.LatLngTuple): Set<string> {
    const point = L.latLng(position);
    return new Set(DEMO_GEOFENCES
      .filter(geofence => point.distanceTo(geofence.center) <= geofence.radius)
      .map(geofence => geofence.id));
  }

  private checkSpeedAlert(truck: DemoTruck): void {
    const isAlreadySpeeding = this.speedingTrucks.has(truck.id);
    const isSpeeding = truck.status === 'moving' && truck.speed > this.speedLimit;

    if (isSpeeding && !isAlreadySpeeding) {
      this.addAlert('speed', truck, `${truck.speed} km/h · límite de ${this.speedLimit} km/h`);
    }
    if (isSpeeding) {
      this.speedingTrucks.add(truck.id);
    } else {
      this.speedingTrucks.delete(truck.id);
    }
  }

  private addAlert(type: DemoAlertType, truck: DemoTruck, detail: string): void {
    this.alertId += 1;
    this.alerts.update(alerts => [{
      id: this.alertId,
      type,
      truckId: truck.id,
      title: ALERT_TITLES[type],
      detail,
      createdAt: Date.now()
    }, ...alerts].slice(0, 8));
  }

  private updateSelectedRouteStyles(): void {
    for (const [truckId, routeLine] of this.routeLines) {
      const isSelected = truckId === this.selectedTruckId();
      routeLine.setStyle({
        opacity: isSelected ? 0.55 : 0.18,
        weight: isSelected ? 4 : 3
      });
      this.routeProgressLines.get(truckId)?.setStyle({
        opacity: isSelected ? 0.9 : 0.35,
        weight: isSelected ? 4 : 2
      });
    }
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
    return `<strong>${truck.name}</strong><br>${truck.plate} · ${STATUS_LABELS[truck.status]} · ${truck.speed} km/h`;
  }
}
