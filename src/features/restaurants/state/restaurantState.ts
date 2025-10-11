import { useReducer } from "react";

export type DialogType = "restaurant" | "service" | "costCentre" | "franchisee" | "assignGestor" | null;

export interface RestaurantState {
  activeTab: string;
  openDialog: DialogType;
  editingItem: any | null;
  selectedCentro: string | null;
  searchQuery: string;
  filters: {
    activo?: boolean;
    franchiseeId?: string;
  };
}

export type RestaurantAction =
  | { type: "SET_TAB"; payload: string }
  | { type: "OPEN_DIALOG"; payload: { dialog: DialogType; item?: any } }
  | { type: "CLOSE_DIALOG" }
  | { type: "SELECT_CENTRO"; payload: string | null }
  | { type: "SET_SEARCH"; payload: string }
  | { type: "SET_FILTER"; payload: { key: keyof RestaurantState["filters"]; value: any } }
  | { type: "CLEAR_FILTERS" }
  | { type: "RESET" };

export const initialRestaurantState: RestaurantState = {
  activeTab: "general",
  openDialog: null,
  editingItem: null,
  selectedCentro: null,
  searchQuery: "",
  filters: {},
};

export function restaurantReducer(
  state: RestaurantState,
  action: RestaurantAction
): RestaurantState {
  switch (action.type) {
    case "SET_TAB":
      return { ...state, activeTab: action.payload };

    case "OPEN_DIALOG":
      return {
        ...state,
        openDialog: action.payload.dialog,
        editingItem: action.payload.item ?? null,
      };

    case "CLOSE_DIALOG":
      return {
        ...state,
        openDialog: null,
        editingItem: null,
      };

    case "SELECT_CENTRO":
      return {
        ...state,
        selectedCentro: action.payload,
        // Reset search when changing centro
        searchQuery: "",
      };

    case "SET_SEARCH":
      return {
        ...state,
        searchQuery: action.payload,
      };

    case "SET_FILTER":
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.payload.key]: action.payload.value,
        },
      };

    case "CLEAR_FILTERS":
      return {
        ...state,
        filters: {},
        searchQuery: "",
      };

    case "RESET":
      return initialRestaurantState;

    default:
      return state;
  }
}

/**
 * Custom hook for managing restaurant page state
 */
export const useRestaurantState = (initialState?: Partial<RestaurantState>) => {
  const [state, dispatch] = useReducer(
    restaurantReducer,
    { ...initialRestaurantState, ...initialState }
  );

  return {
    state,
    
    // Tab management
    setActiveTab: (tab: string) => 
      dispatch({ type: "SET_TAB", payload: tab }),

    // Dialog management
    openDialog: (dialog: DialogType, item?: any) =>
      dispatch({ type: "OPEN_DIALOG", payload: { dialog, item } }),
    closeDialog: () => 
      dispatch({ type: "CLOSE_DIALOG" }),

    // Centro selection
    selectCentro: (centro: string | null) =>
      dispatch({ type: "SELECT_CENTRO", payload: centro }),

    // Search
    setSearchQuery: (query: string) =>
      dispatch({ type: "SET_SEARCH", payload: query }),

    // Filters
    setFilter: (key: keyof RestaurantState["filters"], value: any) =>
      dispatch({ type: "SET_FILTER", payload: { key, value } }),
    clearFilters: () =>
      dispatch({ type: "CLEAR_FILTERS" }),

    // Reset
    reset: () =>
      dispatch({ type: "RESET" }),
  };
};
