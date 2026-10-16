package com.sadagir.callrecorder;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CallRecorderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
