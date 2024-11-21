# Akvorado

Akvorado netflow data source using akvorado api


## Introduction
This plugin aim to allow user to display [akvorado](https://github.com/akvorado/akvorado) data directly in Grafana.
![example1](https://github.com/moutyque/grafana-akvorado/blob/main/src/img/example1.png?raw=true)
![example2](https://github.com/moutyque/grafana-akvorado/blob/main/src/img/example2.png?raw=true)

## Requirements
List any requirements or dependencies they may need to run the plugin.

## Getting Started

In Grafana:

- Add new data source
- Akvorado
- Add new `Akvorado` data source

![datasource.png](https://github.com/moutyque/grafana-akvorado/blob/main/src/img/datasource.png?raw=true)
- Enter the base url; eg: https://demo.akvorado.net/

![connection.png](https://github.com/moutyque/grafana-akvorado/blob/main/src/img/connection.png?raw=true)

## Building queries

Queries can be built using pre-configured parameters.

### Query parameters

- Type of query:
    - sankey
        - _When using sankey at least two dimension must be used_
    - timeseries
- Unit
    - l3bps
    - pps
- Dimension
    - Multiselect list: values are fetch from the back end
- Limit: number of returned result
    - _The number of return result is in fact limit +1 where +1 is the value "other" showing the aggregation of all other values_
- Filters: expression to filter result
    - _The field is autocomplete and lint based on syntax checker_

### Query examples

Visualize the top 10 traffic per Source BGP AS for Ingress traffic, in bytes per second (pps)
![example1.png](https://github.com/moutyque/grafana-akvorado/blob/main/src/img/example1.png?raw=true)

Visualize the Top 10 Source BGP AS and Exporter Site for Ingress traffic, in packets per second (pps)
![example2.png](https://github.com/moutyque/grafana-akvorado/blob/main/src/img/example2.png?raw=true)
## Contributing

If you want to contribute feel free to open a PR in this [repo](https://github.com/moutyque/grafana-akvorado)
