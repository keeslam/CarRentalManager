import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { Vehicle, Expense, Reservation, Customer } from "@shared/schema";
import { formatDate, formatCurrency, formatLicensePlate } from "@/lib/format-utils";
import { isTrueValue } from "@/lib/utils";
import { addDays, format, subMonths, subDays, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from "date-fns";
import { Calendar, Download, FileText, TrendingUp, Car, Settings, User, DollarSign, BarChart, PieChart, Activity, AlertTriangle, Wrench } from "lucide-react";
import { DateRange } from "react-day-picker";



/**
 * Reports Page - Generate and display reports for the car rental business
 */
export default function ReportsPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState("operations");
  
  // Date range state with default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  
  // Vehicle filter
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");
  
  // Expense category filter
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Fetch all vehicles for filtering
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });
  
  // Fetch expenses with date filtering
  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });
  
  // Fetch reservations with date filtering
  const { data: reservations = [] } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations"],
  });
  
  // Fetch customers 
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Filter expenses by date range and selected category
  const filteredExpenses = expenses?.filter(expense => {
    // Skip date filter if dates are undefined
    if (!dateRange.from || !dateRange.to) return false;
    
    const expenseDate = new Date(expense.date);
    const withinDateRange = isWithinInterval(expenseDate, {
      start: dateRange.from,
      end: dateRange.to
    });
    
    const matchesCategory = selectedCategory === "all" || expense.category === selectedCategory;
    const matchesVehicle = selectedVehicle === "all" || expense.vehicleId.toString() === selectedVehicle;
    
    return withinDateRange && matchesCategory && matchesVehicle;
  }) || [];
  
  // Filter reservations by date range and vehicle
  const filteredReservations = reservations?.filter(reservation => {
    // Skip date filter if dates are undefined
    if (!dateRange.from || !dateRange.to) return false;
    
    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);
    
    // Consider reservation within range if any part of it falls within the selected date range
    const overlapsDateRange = (
      (startDate <= dateRange.to && startDate >= dateRange.from) || // Start date within range
      (endDate <= dateRange.to && endDate >= dateRange.from) || // End date within range
      (startDate <= dateRange.from && endDate >= dateRange.to) // Reservation spans entire range
    );
    
    const matchesVehicle = selectedVehicle === "all" || reservation.vehicleId.toString() === selectedVehicle;
    
    return overlapsDateRange && matchesVehicle;
  }) || [];
  
  // Calculate expense totals by category
  const expensesByCategory: Record<string, number> = {};
  filteredExpenses.forEach(expense => {
    const category = expense.category;
    if (!expensesByCategory[category]) {
      expensesByCategory[category] = 0;
    }
    expensesByCategory[category] += Number(expense.amount);
  });
  
  // Calculate total expenses
  const totalExpenses = filteredExpenses.reduce((sum, expense) => {
    return sum + Number(expense.amount);
  }, 0);
  
  // Calculate total revenue from reservations
  const totalRevenue = filteredReservations.reduce((sum, reservation) => {
    return sum + Number(reservation.totalPrice || 0);
  }, 0);
  
  // Calculate profit
  const profit = totalRevenue - totalExpenses;
  
  // Calculate average expense per vehicle
  const activeVehicleCount = vehicles.filter(v => isTrueValue(v.active)).length || 1;
  const avgExpensePerVehicle = totalExpenses / activeVehicleCount;
  
  // Calculate vehicle utilization data
  const vehicleUtilizationData = vehicles.map(vehicle => {
    const vehicleReservations = filteredReservations.filter(r => r.vehicleId === vehicle.id);
    
    // Calculate total days reserved
    let daysReserved = 0;
    if (dateRange.from && dateRange.to) {
      const totalDaysInRange = differenceInDays(dateRange.to, dateRange.from) + 1;
      
      // For each day in the range, check if the vehicle was reserved
      for (let d = 0; d < totalDaysInRange; d++) {
        const currentDate = addDays(dateRange.from, d);
        const isReserved = vehicleReservations.some(reservation => {
          const startDate = new Date(reservation.startDate);
          const endDate = new Date(reservation.endDate);
          return currentDate >= startDate && currentDate <= endDate;
        });
        
        if (isReserved) {
          daysReserved++;
        }
      }
    }
    
    // Calculate utilization percentage
    const utilizationPercentage = dateRange.from && dateRange.to
      ? (daysReserved / (differenceInDays(dateRange.to, dateRange.from) + 1)) * 100
      : 0;
    
    return {
      id: vehicle.id,
      licensePlate: vehicle.licensePlate,
      brand: vehicle.brand,
      model: vehicle.model,
      daysReserved,
      utilizationPercentage: Math.round(utilizationPercentage),
      reservationCount: vehicleReservations.length
    };
  }).sort((a, b) => b.utilizationPercentage - a.utilizationPercentage);
  
  // Calculate maintenance cost by vehicle
  const maintenanceCostByVehicle = vehicles.map(vehicle => {
    const vehicleExpenses = filteredExpenses.filter(e => e.vehicleId === vehicle.id);
    const maintenanceExpenses = vehicleExpenses.filter(e => 
      e.category === 'maintenance' || e.category === 'repair' || e.category === 'tires'
    );
    
    const totalMaintenanceCost = maintenanceExpenses.reduce((sum, expense) => {
      return sum + Number(expense.amount);
    }, 0);
    
    return {
      id: vehicle.id,
      licensePlate: vehicle.licensePlate,
      brand: vehicle.brand,
      model: vehicle.model,
      maintenanceCost: totalMaintenanceCost,
      expenseCount: maintenanceExpenses.length
    };
  }).sort((a, b) => b.maintenanceCost - a.maintenanceCost);
  
  // Calculate customer reservation stats
  const customerReservationStats = customers.map(customer => {
    const customerReservations = filteredReservations.filter(r => r.customerId === customer.id);
    
    // Calculate total spent
    const totalSpent = customerReservations.reduce((sum, reservation) => {
      return sum + Number(reservation.totalPrice || 0);
    }, 0);
    
    return {
      id: customer.id,
      name: customer.name,
      reservationCount: customerReservations.length,
      totalSpent
    };
  }).sort((a, b) => b.reservationCount - a.reservationCount);
  
  // Prepare data for charts
  const revenueChartData = prepareMonthlyRevenueData(filteredReservations, filteredExpenses);
  
  // Calculate expense trend (last 3 months comparison)
  const expenseTrend = (() => {
    // Get expense totals for current month, previous month, and 2 months ago
    const now = new Date();
    const currentMonth = startOfMonth(now);
    const previousMonth = startOfMonth(subMonths(now, 1));
    const twoMonthsAgo = startOfMonth(subMonths(now, 2));
    
    const currentMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= currentMonth && expenseDate <= endOfMonth(currentMonth);
    }).reduce((sum, expense) => sum + Number(expense.amount), 0);
    
    const previousMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= previousMonth && expenseDate < currentMonth;
    }).reduce((sum, expense) => sum + Number(expense.amount), 0);
    
    const twoMonthsAgoExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= twoMonthsAgo && expenseDate < previousMonth;
    }).reduce((sum, expense) => sum + Number(expense.amount), 0);
    
    // Calculate month-over-month change percentages
    const currentVsPrevious = previousMonthExpenses === 0 
      ? 100 
      : ((currentMonthExpenses - previousMonthExpenses) / previousMonthExpenses) * 100;
      
    const previousVsTwoMonths = twoMonthsAgoExpenses === 0 
      ? 100 
      : ((previousMonthExpenses - twoMonthsAgoExpenses) / twoMonthsAgoExpenses) * 100;
    
    return {
      currentMonth: {
        name: format(currentMonth, 'MMM yyyy'),
        total: currentMonthExpenses,
        changePercentage: currentVsPrevious
      },
      previousMonth: {
        name: format(previousMonth, 'MMM yyyy'),
        total: previousMonthExpenses,
        changePercentage: previousVsTwoMonths
      },
      twoMonthsAgo: {
        name: format(twoMonthsAgo, 'MMM yyyy'),
        total: twoMonthsAgoExpenses
      }
    };
  })();

  // Function to handle exporting reports
  const exportReport = (reportType: string) => {
    // This would be implemented to generate a PDF or CSV export of the current report
    console.log(`Exporting ${reportType} report for date range:`, dateRange);
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and analyze reports for your car rental business
          </p>
        </div>
        <Button onClick={() => exportReport(activeTab)}>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>
      
      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>
            Adjust the filters to customize your report view
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <DatePickerWithRange 
                date={dateRange}
                setDate={setDateRange}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Vehicle</label>
              <Select
                value={selectedVehicle}
                onValueChange={setSelectedVehicle}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Vehicles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {vehicles?.map(vehicle => (
                    <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                      {vehicle.brand} {vehicle.model} ({formatLicensePlate(vehicle.licensePlate)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Expense Category</label>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="tires">Tires</SelectItem>
                  <SelectItem value="front window">Front Window</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="financial">
            <DollarSign className="h-4 w-4 mr-2" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="vehicles">
            <Car className="h-4 w-4 mr-2" />
            Vehicles
          </TabsTrigger>
          <TabsTrigger value="customers">
            <User className="h-4 w-4 mr-2" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="operations">
            <Settings className="h-4 w-4 mr-2" />
            Operations
          </TabsTrigger>
        </TabsList>
        
        {/* Financial Reports Tab */}
        <TabsContent value="financial" className="space-y-6">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  For period {dateRange.from && dateRange.to ? `${format(dateRange.from, 'PP')} - ${format(dateRange.to, 'PP')}` : 'No date range selected'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {filteredExpenses.length} expense entries
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(profit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {profit >= 0 ? 'Profit' : 'Loss'} for selected period
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue vs. Expenses Over Time</CardTitle>
              <CardDescription>
                Monthly breakdown for the selected date range
              </CardDescription>
            </CardHeader>
            <CardContent className="h-96">
              <RevenueChart data={revenueChartData} />
            </CardContent>
          </Card>
          
          {/* Expense Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Expense Breakdown by Category</CardTitle>
              <CardDescription>
                Detailed breakdown of expenses for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(expensesByCategory).length > 0 ? (
                  Object.entries(expensesByCategory)
                    .sort(([_, a], [__, b]) => b - a) // Sort by amount descending
                    .map(([category, amount]) => (
                      <div key={category} className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-primary mr-2"></div>
                          <span className="font-medium capitalize">{category}</span>
                        </div>
                        <div className="font-semibold">{formatCurrency(amount)}</div>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No expense data available for the selected filters
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                The most recent financial transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredExpenses.slice(0, 5).map((expense) => (
                  <div key={expense.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <div className="font-medium">{expense.category} - {expense.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(expense.date)} · {
                          vehicles?.find(v => v.id === expense.vehicleId)?.licensePlate 
                          ? formatLicensePlate(vehicles.find(v => v.id === expense.vehicleId)!.licensePlate)
                          : 'General'
                        }
                      </div>
                    </div>
                    <div className="font-semibold text-red-600">-{formatCurrency(Number(expense.amount))}</div>
                  </div>
                ))}
                
                {filteredReservations.slice(0, 5).map((reservation) => (
                  <div key={reservation.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <div className="font-medium">
                        Reservation - {customers?.find(c => c.id === reservation.customerId)?.name || 'Unknown Customer'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(reservation.startDate)} to {formatDate(reservation.endDate)} · {
                          vehicles?.find(v => v.id === reservation.vehicleId)?.licensePlate 
                          ? formatLicensePlate(vehicles.find(v => v.id === reservation.vehicleId)!.licensePlate)
                          : 'Unknown Vehicle'
                        }
                      </div>
                    </div>
                    <div className="font-semibold text-green-600">+{formatCurrency(Number(reservation.totalPrice || 0))}</div>
                  </div>
                ))}
                
                {filteredExpenses.length === 0 && filteredReservations.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    No transaction data available for the selected filters
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Vehicles Report Tab */}
        <TabsContent value="vehicles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Performance Report</CardTitle>
              <CardDescription>
                Revenue and expense analysis by vehicle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {vehicles?.map(vehicle => {
                  // Calculate revenue for this vehicle
                  const vehicleReservations = filteredReservations.filter(r => r.vehicleId === vehicle.id);
                  const vehicleRevenue = vehicleReservations.reduce((sum, r) => sum + Number(r.totalPrice || 0), 0);
                  
                  // Calculate expenses for this vehicle
                  const vehicleExpenses = filteredExpenses.filter(e => e.vehicleId === vehicle.id);
                  const vehicleExpenseTotal = vehicleExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
                  
                  // Calculate profit
                  const vehicleProfit = vehicleRevenue - vehicleExpenseTotal;
                  
                  // Calculate occupancy rate (days rented / total days in period)
                  const totalDaysInPeriod = dateRange.from && dateRange.to 
                    ? Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) 
                    : 30; // Default to 30 days if no date range
                    
                  const daysRented = vehicleReservations.reduce((days, reservation) => {
                    if (!dateRange.from || !dateRange.to) return days;
                    
                    const reservationStart = new Date(reservation.startDate) < dateRange.from ? dateRange.from : new Date(reservation.startDate);
                    const reservationEnd = new Date(reservation.endDate) > dateRange.to ? dateRange.to : new Date(reservation.endDate);
                    
                    if (!reservationStart || !reservationEnd) return days;
                    
                    const reservationDays = Math.ceil((reservationEnd.getTime() - reservationStart.getTime()) / (1000 * 60 * 60 * 24));
                    return days + reservationDays;
                  }, 0);
                  
                  const occupancyRate = totalDaysInPeriod > 0 ? (daysRented / totalDaysInPeriod) * 100 : 0;
                  
                  return (
                    <div key={vehicle.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{vehicle.brand} {vehicle.model}</h3>
                          <p className="text-muted-foreground">{formatLicensePlate(vehicle.licensePlate)}</p>
                        </div>
                        <div className={`font-bold ${vehicleProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(vehicleProfit)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Revenue</p>
                          <p className="font-medium">{formatCurrency(vehicleRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Expenses</p>
                          <p className="font-medium">{formatCurrency(vehicleExpenseTotal)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                          <p className="font-medium">{occupancyRate.toFixed(1)}%</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Reservations: {vehicleReservations.length}</p>
                        <div className="h-2 bg-gray-200 rounded-full">
                          <div 
                            className="h-2 bg-primary rounded-full" 
                            style={{ width: `${occupancyRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {!vehicles?.length && (
                  <p className="text-muted-foreground text-center py-4">
                    No vehicle data available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Cost Analysis</CardTitle>
              <CardDescription>
                Expense breakdown by vehicle and category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {vehicles?.map(vehicle => {
                  const vehicleExpenses = filteredExpenses.filter(e => e.vehicleId === vehicle.id);
                  
                  if (vehicleExpenses.length === 0) return null;
                  
                  // Group expenses by category
                  const expenseCategories: Record<string, number> = {};
                  vehicleExpenses.forEach(expense => {
                    if (!expenseCategories[expense.category]) {
                      expenseCategories[expense.category] = 0;
                    }
                    expenseCategories[expense.category] += Number(expense.amount);
                  });
                  
                  return (
                    <div key={vehicle.id} className="border-b pb-4">
                      <h3 className="font-semibold mb-2">{vehicle.brand} {vehicle.model} ({formatLicensePlate(vehicle.licensePlate)})</h3>
                      <div className="space-y-2">
                        {Object.entries(expenseCategories).map(([category, amount]) => (
                          <div key={category} className="flex justify-between">
                            <span className="capitalize">{category}</span>
                            <span>{formatCurrency(amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold pt-2 border-t">
                          <span>Total</span>
                          <span>{formatCurrency(vehicleExpenses.reduce((sum, e) => sum + Number(e.amount), 0))}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {filteredExpenses.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    No expense data available for the selected filters
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Customers Report Tab */}
        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Activity Report</CardTitle>
              <CardDescription>
                Customer booking patterns and revenue generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {customers?.map(customer => {
                  // Get reservations for this customer
                  const customerReservations = filteredReservations.filter(r => r.customerId === customer.id);
                  if (customerReservations.length === 0) return null;
                  
                  // Calculate total revenue from this customer
                  const customerRevenue = customerReservations.reduce((sum, r) => sum + Number(r.totalPrice || 0), 0);
                  
                  // Calculate average reservation duration
                  const totalDays = customerReservations.reduce((days, reservation) => {
                    const start = new Date(reservation.startDate);
                    const end = new Date(reservation.endDate);
                    const reservationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    return days + reservationDays;
                  }, 0);
                  
                  const averageDuration = totalDays / customerReservations.length;
                  
                  return (
                    <div key={customer.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{customer.name}</h3>
                          <p className="text-muted-foreground">
                            {customer.companyName || (customer.firstName && customer.lastName 
                              ? `${customer.firstName} ${customer.lastName}` 
                              : 'Individual Customer')}
                          </p>
                        </div>
                        <div className="font-bold text-green-600">
                          {formatCurrency(customerRevenue)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Reservations</p>
                          <p className="font-medium">{customerReservations.length}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Avg. Duration</p>
                          <p className="font-medium">{averageDuration.toFixed(1)} days</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Avg. Value</p>
                          <p className="font-medium">{formatCurrency(customerRevenue / customerReservations.length)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {!filteredReservations.length && (
                  <p className="text-muted-foreground text-center py-4">
                    No customer activity data for the selected period
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Operations Report Tab */}
        <TabsContent value="operations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Utilization</CardTitle>
              <CardDescription>
                Overall fleet utilization statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Fleet Status Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-muted-foreground text-sm">Total Vehicles</p>
                    <p className="text-2xl font-bold">{vehicles?.length || 0}</p>
                  </div>
                  
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-muted-foreground text-sm">Currently Reserved</p>
                    <p className="text-2xl font-bold">
                      {reservations?.filter(r => {
                        const now = new Date();
                        const startDate = new Date(r.startDate);
                        const endDate = new Date(r.endDate);
                        return startDate <= now && endDate >= now;
                      }).length || 0}
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-muted-foreground text-sm">Avg. Daily Revenue</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(totalRevenue / Math.max(1, dateRange.from && dateRange.to ? Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) : 30))}
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-muted-foreground text-sm">Maintenance Costs</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(filteredExpenses.filter(e => e.category === 'maintenance').reduce((sum, e) => sum + Number(e.amount), 0))}
                    </p>
                  </div>
                </div>
                
                {/* Utilization Rate Chart/Graph would go here */}
                <div className="border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Fleet Utilization Over Time</h3>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
                    <p className="text-muted-foreground">Utilization chart will be implemented here</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Schedule</CardTitle>
              <CardDescription>
                Upcoming and recent maintenance activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* You would load and display maintenance schedule data here */}
                <p className="text-muted-foreground text-center py-4">
                  Maintenance schedule data will be implemented in a future update
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper function to prepare monthly revenue data for charts
function prepareMonthlyRevenueData(reservations: Reservation[], expenses: Expense[]) {
  const data: { name: string; revenue: number; expenses: number }[] = [];
  
  // Get earliest date from both datasets
  let earliestDate = new Date();
  if (reservations.length) {
    const earliestReservation = new Date(Math.min(...reservations.map(r => new Date(r.startDate).getTime())));
    earliestDate = earliestReservation < earliestDate ? earliestReservation : earliestDate;
  }
  if (expenses.length) {
    const earliestExpense = new Date(Math.min(...expenses.map(e => new Date(e.date).getTime())));
    earliestDate = earliestExpense < earliestDate ? earliestExpense : earliestDate;
  }
  
  // Get latest date from both datasets
  let latestDate = new Date(0); // Start with earliest possible date
  if (reservations.length) {
    const latestReservation = new Date(Math.max(...reservations.map(r => new Date(r.endDate).getTime())));
    latestDate = latestReservation > latestDate ? latestReservation : latestDate;
  }
  if (expenses.length) {
    const latestExpense = new Date(Math.max(...expenses.map(e => new Date(e.date).getTime())));
    latestDate = latestExpense > latestDate ? latestExpense : latestDate;
  }
  
  // Ensure we have at least current month if no data
  if (latestDate.getTime() === 0) {
    latestDate = new Date();
  }
  
  // Start from the first day of the earliest month
  const startDate = startOfMonth(earliestDate);
  // End at the last day of the latest month
  const endDate = endOfMonth(latestDate);
  
  // Iterate through each month
  let currentDate = startDate;
  while (currentDate <= endDate) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthName = format(monthStart, 'MMM yyyy');
    
    // Calculate revenue for this month
    const monthlyRevenue = reservations
      .filter(reservation => {
        const startDate = new Date(reservation.startDate);
        const endDate = new Date(reservation.endDate);
        // Consider reservation in this month if any part of it falls within the month
        return (
          (startDate <= monthEnd && startDate >= monthStart) || // Start date within month
          (endDate <= monthEnd && endDate >= monthStart) || // End date within month
          (startDate <= monthStart && endDate >= monthEnd) // Reservation spans entire month
        );
      })
      .reduce((sum, reservation) => {
        // For simplicity, we'll count the full reservation amount in the month it starts
        // A more accurate approach would prorate the amount across months
        return sum + Number(reservation.totalPrice || 0);
      }, 0);
    
    // Calculate expenses for this month
    const monthlyExpenses = expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= monthStart && expenseDate <= monthEnd;
      })
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    
    // Add data point for this month
    data.push({
      name: monthName,
      revenue: monthlyRevenue,
      expenses: monthlyExpenses
    });
    
    // Move to next month
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }
  
  return data;
}