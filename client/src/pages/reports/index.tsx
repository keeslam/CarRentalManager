import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExpenseChart, type ExpenseChartData } from "@/components/reports/expense-chart";
import { UtilizationChart, type UtilizationChartData } from "@/components/reports/utilization-chart";
import { Vehicle, Expense, Reservation, Customer } from "@shared/schema";
import { formatDate, formatCurrency, formatLicensePlate } from "@/lib/format-utils";
import { isTrueValue } from "@/lib/utils";
import { addDays, format, subMonths, subDays, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from "date-fns";
import { 
  Calendar, Download, FileText, TrendingUp, Car, Settings, User, 
  DollarSign, BarChart, PieChart, Activity, AlertTriangle, Wrench 
} from "lucide-react";
import { DateRange } from "react-day-picker";

/**
 * Reports Page - Generate and display reports for the car rental business
 * This page focuses on operational aspects rather than revenue
 */
export default function ReportsPage() {
  // Tab state - default to operations tab
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
  const filteredExpenses = expenses.filter(expense => {
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
  });
  
  // Filter reservations by date range and vehicle
  const filteredReservations = reservations.filter(reservation => {
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
  });
  
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
  
  // Calculate the number of vehicles with activity (have expenses or reservations) as an alternative to "active" property
  const vehiclesWithActivity = vehicles.filter(v => 
    filteredExpenses.some(e => e.vehicleId === v.id) || 
    filteredReservations.some(r => r.vehicleId === v.id)
  );
  const activeVehicleCount = vehiclesWithActivity.length || vehicles.length || 1;
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
    
    return {
      id: customer.id,
      name: customer.name,
      reservationCount: customerReservations.length
    };
  }).sort((a, b) => b.reservationCount - a.reservationCount);
  
  // Prepare expense chart data
  const expenseChartData: ExpenseChartData[] = Object.entries(expensesByCategory)
    .map(([category, amount]) => ({
      name: category.charAt(0).toUpperCase() + category.slice(1),
      expenses: amount
    }))
    .sort((a, b) => b.expenses - a.expenses);
  
  // Prepare utilization chart data
  const utilizationChartData: UtilizationChartData[] = vehicleUtilizationData
    .filter(v => v.utilizationPercentage > 0)
    .slice(0, 10)
    .map(vehicle => ({
      name: formatLicensePlate(vehicle.licensePlate),
      utilization: vehicle.utilizationPercentage
    }));
  
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
          <TabsTrigger value="operations">
            <Settings className="h-4 w-4 mr-2" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="expenses">
            <DollarSign className="h-4 w-4 mr-2" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="vehicles">
            <Car className="h-4 w-4 mr-2" />
            Vehicles
          </TabsTrigger>
          <TabsTrigger value="customers">
            <User className="h-4 w-4 mr-2" />
            Customers
          </TabsTrigger>
        </TabsList>
        
        {/* Operations Overview Tab */}
        <TabsContent value="operations" className="space-y-6">
          {/* Operations Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Vehicle Utilization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {vehicleUtilizationData.length > 0 
                    ? `${Math.round(vehicleUtilizationData.reduce((sum, v) => sum + v.utilizationPercentage, 0) / vehicleUtilizationData.length)}%`
                    : '0%'
                  }
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average across {vehicleUtilizationData.filter(v => v.utilizationPercentage > 0).length} active vehicles
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(Number(totalExpenses))}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {filteredExpenses.length} expense entries
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg. Cost Per Vehicle</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(Number(avgExpensePerVehicle))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  For {activeVehicleCount} active vehicles
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Activity Overview */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Vehicle Utilization Chart */}
            <Card className="xl:col-span-1">
              <CardHeader>
                <CardTitle>Vehicle Utilization</CardTitle>
                <CardDescription>
                  Top 10 vehicles by utilization rate
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <UtilizationChart data={utilizationChartData} />
              </CardContent>
            </Card>
            
            {/* Expense by Category Chart */}
            <Card className="xl:col-span-1">
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
                <CardDescription>
                  Distribution of expenses for the selected period
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ExpenseChart data={expenseChartData} />
              </CardContent>
            </Card>
          </div>
          
          {/* Monthly Expense Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Expense Trends</CardTitle>
              <CardDescription>
                Monthly expense comparison
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">{expenseTrend.currentMonth.name}</h4>
                      <p className="text-2xl font-bold">{formatCurrency(Number(expenseTrend.currentMonth.total))}</p>
                    </div>
                    <div className={`text-sm px-2 py-1 rounded-md ${expenseTrend.currentMonth.changePercentage > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {expenseTrend.currentMonth.changePercentage > 0 ? '+' : ''}{Math.round(expenseTrend.currentMonth.changePercentage)}%
                    </div>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">{expenseTrend.previousMonth.name}</h4>
                      <p className="text-2xl font-bold">{formatCurrency(Number(expenseTrend.previousMonth.total))}</p>
                    </div>
                    <div className={`text-sm px-2 py-1 rounded-md ${expenseTrend.previousMonth.changePercentage > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {expenseTrend.previousMonth.changePercentage > 0 ? '+' : ''}{Math.round(expenseTrend.previousMonth.changePercentage)}%
                    </div>
                  </div>
                  <Progress 
                    value={expenseTrend.currentMonth.total === 0 
                      ? 0 
                      : (expenseTrend.previousMonth.total / expenseTrend.currentMonth.total) * 100} 
                    className="h-2" 
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">{expenseTrend.twoMonthsAgo.name}</h4>
                      <p className="text-2xl font-bold">{formatCurrency(Number(expenseTrend.twoMonthsAgo.total))}</p>
                    </div>
                  </div>
                  <Progress 
                    value={expenseTrend.currentMonth.total === 0 
                      ? 0 
                      : (expenseTrend.twoMonthsAgo.total / expenseTrend.currentMonth.total) * 100}
                    className="h-2" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-6">
          {/* Expense Summary */}
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
                        <div className="flex items-center space-x-4">
                          <span className="text-muted-foreground text-sm">
                            {filteredExpenses.filter(e => e.category === category).length} items
                          </span>
                          <span className="font-medium">{formatCurrency(Number(amount))}</span>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">No expenses found for the selected filters</p>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Expense List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>
                Detailed list of expenses for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.length > 0 ? (
                    filteredExpenses
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 10) // Show most recent 10 expenses
                      .map(expense => {
                        const vehicle = vehicles.find(v => v.id === expense.vehicleId);
                        return (
                          <TableRow key={expense.id}>
                            <TableCell>{formatDate(expense.date)}</TableCell>
                            <TableCell>
                              {vehicle 
                                ? `${vehicle.brand} ${vehicle.model} (${formatLicensePlate(vehicle.licensePlate)})` 
                                : 'Unknown Vehicle'}
                            </TableCell>
                            <TableCell className="capitalize">{expense.category}</TableCell>
                            <TableCell>{expense.description}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(expense.amount))}</TableCell>
                          </TableRow>
                        );
                      })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">No expenses found for the selected filters</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          {/* Expense Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Expense Visualization</CardTitle>
              <CardDescription>
                Visual breakdown by category
              </CardDescription>
            </CardHeader>
            <CardContent className="h-96">
              <ExpenseChart data={expenseChartData} />
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Vehicles Tab */}
        <TabsContent value="vehicles" className="space-y-6">
          {/* Vehicle Utilization Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Utilization</CardTitle>
              <CardDescription>
                Utilization rates across all vehicles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>License Plate</TableHead>
                    <TableHead>Days Reserved</TableHead>
                    <TableHead>Reservations</TableHead>
                    <TableHead>Utilization</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicleUtilizationData.length > 0 ? (
                    vehicleUtilizationData
                      .slice(0, 10) // Show top 10 vehicles
                      .map(vehicle => (
                        <TableRow key={vehicle.id}>
                          <TableCell>{vehicle.brand} {vehicle.model}</TableCell>
                          <TableCell>{formatLicensePlate(vehicle.licensePlate)}</TableCell>
                          <TableCell>{vehicle.daysReserved} days</TableCell>
                          <TableCell>{vehicle.reservationCount}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Progress
                                value={vehicle.utilizationPercentage}
                                className="h-2 w-20"
                              />
                              <span>{vehicle.utilizationPercentage}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">No vehicle utilization data available</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          {/* Vehicle Maintenance Costs */}
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Costs by Vehicle</CardTitle>
              <CardDescription>
                Total maintenance and repair expenses per vehicle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>License Plate</TableHead>
                    <TableHead>Expense Count</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceCostByVehicle.filter(v => v.maintenanceCost > 0).length > 0 ? (
                    maintenanceCostByVehicle
                      .filter(v => v.maintenanceCost > 0)
                      .slice(0, 10) // Show top 10 vehicles by maintenance cost
                      .map(vehicle => (
                        <TableRow key={vehicle.id}>
                          <TableCell>{vehicle.brand} {vehicle.model}</TableCell>
                          <TableCell>{formatLicensePlate(vehicle.licensePlate)}</TableCell>
                          <TableCell>{vehicle.expenseCount} entries</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(vehicle.maintenanceCost))}</TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4">No maintenance cost data available</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          {/* Vehicle Utilization Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Utilization Visualization</CardTitle>
              <CardDescription>
                Top vehicles by utilization percentage
              </CardDescription>
            </CardHeader>
            <CardContent className="h-96">
              <UtilizationChart data={utilizationChartData} />
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          {/* Customer Booking Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Bookings</CardTitle>
              <CardDescription>
                Customer activity during the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Reservations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerReservationStats.filter(c => c.reservationCount > 0).length > 0 ? (
                    customerReservationStats
                      .filter(c => c.reservationCount > 0)
                      .slice(0, 10)
                      .map(customer => (
                        <TableRow key={customer.id}>
                          <TableCell>{customer.name}</TableCell>
                          <TableCell className="text-right">{customer.reservationCount}</TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-4">No customer activity data available</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          {/* Customer Reservation List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Customer Reservations</CardTitle>
              <CardDescription>
                Details of recent bookings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations.length > 0 ? (
                    filteredReservations
                      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                      .slice(0, 10)
                      .map(reservation => {
                        const vehicle = vehicles.find(v => v.id === reservation.vehicleId);
                        const customer = customers.find(c => c.id === reservation.customerId);
                        
                        return (
                          <TableRow key={reservation.id}>
                            <TableCell>{customer?.name || 'Unknown'}</TableCell>
                            <TableCell>
                              {vehicle 
                                ? `${vehicle.brand} ${vehicle.model} (${formatLicensePlate(vehicle.licensePlate)})` 
                                : 'Unknown Vehicle'}
                            </TableCell>
                            <TableCell>{formatDate(reservation.startDate)}</TableCell>
                            <TableCell>{formatDate(reservation.endDate)}</TableCell>
                            <TableCell className="capitalize">
                              {reservation.status?.replace(/_/g, ' ')}
                            </TableCell>
                          </TableRow>
                        );
                      })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">No reservation data available</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}