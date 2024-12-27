#!/bin/bash
mysqldump -u root -p'142536' 4tdkp > /root/SQLs/backup_$(date +%F_%H-%M-%S).sql

