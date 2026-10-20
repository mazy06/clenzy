package com.clenzy.marketplace.service;

/** IGN inverse Lambert-93 (RGF93), metropolitan addresses only. No overseas CRS assumptions. */
final class BaitlySireneLambert93 {
    private BaitlySireneLambert93() {}
    static double[] point(String xValue,String yValue,String postal) {
        if(!postal.matches("[0-9]{5}")||postal.startsWith("97")||postal.startsWith("98"))return null;
        try {
            double x=Double.parseDouble(xValue),y=Double.parseDouble(yValue);
            if(!Double.isFinite(x)||!Double.isFinite(y)||x<0||x>1400000||y<6000000||y>7200000)return null;
            double n=0.725607765053267,c=11754255.426096,e=0.0818191910428158;
            double dx=x-700000,dy=12655612.049876-y;
            double iso=-Math.log(Math.hypot(dx,dy)/c)/n;
            double phi=2*Math.atan(Math.exp(iso))-Math.PI/2;
            for(int i=0;i<12;i++)phi=2*Math.atan(Math.exp(iso)*Math.pow((1+e*Math.sin(phi))/(1-e*Math.sin(phi)),e/2))-Math.PI/2;
            double lat=Math.toDegrees(phi),lon=3+Math.toDegrees(Math.atan2(dx,dy)/n);
            return lat>=41&&lat<=52&&lon>=-6&&lon<=10?new double[]{lat,lon}:null;
        } catch(NumberFormatException e){return null;}
    }
}
